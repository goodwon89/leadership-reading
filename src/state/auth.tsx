import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authEmail, authPassword } from "../lib/account";
import { db, errMsg } from "../lib/supabase";
import type { Company, Profile } from "../lib/types";
import { fmtDateTime } from "../lib/format";

type Mode = "user" | "admin";
interface AuthState {
  ready: boolean;
  me: Profile | null;
  company: Company | null;
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

  useEffect(() => {
    let alive = true;
    db.auth.getSession().then(async ({ data }: any) => {
      await loadProfile(data?.session?.user?.id ?? null);
      if (alive) setReady(true);
    });
    const { data } = db.auth.onAuthStateChange((event: string, session: any) => {
      if (event === "SIGNED_OUT") { setMe(null); setCompany(null); }
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
  const logout = async () => { await db.auth.signOut(); setMe(null); };
  const refresh = async () => { const { data } = await db.auth.getSession(); await loadProfile(data?.session?.user?.id ?? null); };

  const canAdmin = !!me && me.role !== "user";
  const isSuper = me?.role === "super_admin";
  const setMode = (m: Mode) => { setModeState(m); ls.set(MODE_KEY, m); };
  const effectiveMode: Mode = !me ? "user" : !canAdmin ? "user" : !me.is_participant ? "admin" : mode;
  const scopeCompanyId = !me ? null : isSuper ? scope ?? me.company_id : me.company_id;

  return (
    <Ctx.Provider value={{
      ready, me, company, mode: effectiveMode, setMode, canAdmin, isSuper, scopeCompanyId,
      setScopeCompanyId: (id) => { setScope(id); ls.set(SCOPE_KEY, id); }, login, logout, refresh,
    }}>{children}</Ctx.Provider>
  );
}
