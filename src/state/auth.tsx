import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authEmail, authPassword } from "../lib/account";
import { db, errMsg, setReadOnly } from "../lib/supabase";
import type { Company, Profile } from "../lib/types";
import { fmtDateTime } from "../lib/format";

type Mode = "user" | "admin";
interface AuthState {
  ready: boolean;
  /** 화면 기준 사용자 (총괄이 '계정 화면 보기' 중이면 그 대상) */
  me: Profile | null;
  company: Company | null;
  /** 실제 로그인한 사용자 */
  realMe: Profile | null;
  /** 총괄 관리자의 '계정 화면 보기' 대상 (읽기 전용) */
  viewAs: Profile | null;
  startViewAs: (profileId: string) => Promise<Mode>;
  stopViewAs: () => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  canAdmin: boolean;
  isSuper: boolean;
  /** 관리자 화면에서 보고 있는 계열사 (총괄은 선택 가능) */
  scopeCompanyId: string | null;
  setScopeCompanyId: (id: string) => void;
  login: (companyCode: string, empNo: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(Ctx);

const MODE_KEY = "lr-mode", SCOPE_KEY = "lr-scope";
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [mode, setModeState] = useState<Mode>((ls.get(MODE_KEY) as Mode) || "user");
  const [scope, setScope] = useState<string | null>(ls.get(SCOPE_KEY));
  const [viewAs, setViewAs] = useState<Profile | null>(null);
  const [viewCompany, setViewCompany] = useState<Company | null>(null);
  const [viewMode, setViewMode] = useState<Mode>("user");

  const loadProfile = useCallback(async (uid: string | null) => {
    if (!uid) { setMe(null); setCompany(null); return; }
    const { data: p } = await db.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!p || !p.is_active) { await db.auth.signOut(); setMe(null); return; }
    const { data: c } = await db.from("companies").select("*").eq("id", p.company_id).maybeSingle();
    setMe(p); setCompany(c ?? null);
    db.rpc("touch_seen").then(() => {}, () => {});
    const admin = p.role !== "user";
    // 참가자가 아닌 관리자는 관리자 모드로 고정, 일반 사용자는 참가자 모드로 고정
    if (!admin) setModeState("user");
    else if (!p.is_participant) setModeState("admin");
    if (p.role === "company_admin" || !ls.get(SCOPE_KEY)) setScope(p.company_id);
  }, []);

  const stopViewAs = useCallback(() => { setReadOnly(false); setViewAs(null); setViewCompany(null); }, []);

  useEffect(() => {
    let alive = true;
    db.auth.getSession().then(async ({ data }: any) => {
      await loadProfile(data?.session?.user?.id ?? null);
      if (alive) setReady(true);
    });
    const { data } = db.auth.onAuthStateChange((event: string, session: any) => {
      if (event === "SIGNED_OUT") { setMe(null); setCompany(null); setReadOnly(false); setViewAs(null); }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => loadProfile(session?.user?.id ?? null), 0);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [loadProfile]);

  const login = async (code: string, emp: string, pw: string) => {
    const email = authEmail(code, emp.trim());
    const { data: locked } = await db.rpc("login_guard", { p_email: email });
    if (locked) throw new Error(`로그인 5회 실패로 ${fmtDateTime(locked)}까지 잠겼습니다. 잠시 후 다시 시도하거나 HR 담당자에게 초기화를 요청하세요.`);
    const { data, error } = await db.auth.signInWithPassword({ email, password: authPassword(pw) });
    if (error) {
      const { data: lockedNow } = await db.rpc("login_failed", { p_email: email });
      if (lockedNow) throw new Error("로그인 5회 실패로 10분간 잠겼습니다.");
      throw new Error(errMsg(error));
    }
    await db.rpc("login_ok");
    await loadProfile(data.session.user.id);
  };
  const logout = async () => { stopViewAs(); await db.auth.signOut(); setMe(null); };
  const refresh = async () => { const { data } = await db.auth.getSession(); await loadProfile(data?.session?.user?.id ?? null); };

  /** 총괄 관리자 전용: 다른 계정의 화면을 읽기 전용으로 열람 */
  const startViewAs = async (profileId: string): Promise<Mode> => {
    if (me?.role !== "super_admin") throw new Error("총괄 관리자만 사용할 수 있습니다.");
    const { data: p, error } = await db.from("profiles").select("*").eq("id", profileId).single();
    if (error || !p) throw new Error("대상자를 찾을 수 없습니다.");
    if (p.role === "super_admin") throw new Error("총괄 관리자 계정은 볼 수 없습니다.");
    const { data: c } = await db.from("companies").select("*").eq("id", p.company_id).maybeSingle();
    const m: Mode = p.role === "user" || p.is_participant ? "user" : "admin";
    setViewAs(p); setViewCompany(c ?? null); setViewMode(m); setReadOnly(true);
    return m;
  };

  const eff = viewAs ?? me;
  const canAdmin = !!eff && eff.role !== "user";
  const isSuper = eff?.role === "super_admin";
  const setMode = (m: Mode) => { if (viewAs) { setViewMode(m); return; } setModeState(m); ls.set(MODE_KEY, m); };
  const curMode = viewAs ? viewMode : mode;
  const effectiveMode: Mode = !eff ? "user" : !canAdmin ? "user" : !eff.is_participant ? "admin" : curMode;
  const scopeCompanyId = !eff ? null : isSuper ? scope ?? eff.company_id : eff.company_id;

  return (
    <Ctx.Provider value={{
      ready, me: eff, company: viewAs ? viewCompany : company, realMe: me, viewAs, startViewAs, stopViewAs,
      mode: effectiveMode, setMode, canAdmin, isSuper, scopeCompanyId,
      setScopeCompanyId: (id) => { setScope(id); ls.set(SCOPE_KEY, id); }, login, logout, refresh,
    }}>{children}</Ctx.Provider>
  );
}
