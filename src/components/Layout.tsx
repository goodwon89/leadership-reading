import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { DEMO } from "../lib/supabase";
import { resetDemo } from "../lib/demo/client";
import { Icon, Wordmark, useAsync } from "./ui";
import { ViewAsBar, ViewAsPicker } from "./ViewAs";
import { db } from "../lib/supabase";

const USER_NAV = [
  { to: "/", label: "홈", icon: Icon.home, end: true },
  { to: "/session", label: "이번 회차", icon: Icon.pen },
  { to: "/library", label: "내 서재", icon: Icon.book },
  { to: "/me", label: "내 정보", icon: Icon.user },
];
export const ADMIN_NAV = [
  { to: "/admin", label: "대시보드", end: true },
  { to: "/admin/members", label: "대상자" },
  { to: "/admin/groups", label: "토론 그룹" },
  { to: "/admin/curriculum", label: "도서 편성" },
  { to: "/admin/sessions", label: "회차·출석" },
  { to: "/admin/submissions", label: "제출 현황" },
  { to: "/admin/export", label: "내보내기" },
];
const SUPER_NAV = [
  { to: "/hq", label: "그룹 대시보드", end: true },
  { to: "/hq/insights", label: "인사이트" },
  { to: "/hq/report", label: "분기 보고" },
  { to: "/admin", label: "계열사별 관리" },
  { to: "/hq/settings", label: "설정" },
];

export const SINGLE = import.meta.env.MODE === "single" || import.meta.env.MODE === "artifact";
export function DemoBar() {
  const [ask, setAsk] = useState(false);
  if (!DEMO) return null;
  return (
    <div className="demo-bar">
      데모 모드 · 입력 내용은 이 브라우저에만 저장됩니다. 일정은 시연을 위해 오늘 기준으로 배치되어 있습니다.{SINGLE && " 엑셀 내려받기·인쇄는 실제 배포 버전에서 동작합니다."}
      {ask ? <><button onClick={() => { resetDemo(); try { location.reload(); } catch { /* 일부 프레임은 새로고침 불가 */ } }}>예, 처음 상태로</button><button onClick={() => setAsk(false)}>취소</button></>
        : <button onClick={() => setAsk(true)}>초기화</button>}
    </div>
  );
}

function ThemeBtn() {
  const [dark, setDark] = useState(() => {
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("lr-theme", next); } catch { /* ignore */ }
    setDark(!dark);
  };
  return <button className="icon-btn" onClick={toggle} aria-label={dark ? "라이트 모드" : "다크 모드"} title={dark ? "라이트 모드" : "다크 모드"}>{dark ? <Icon.sun /> : <Icon.moon />}</button>;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { me, mode, setMode, canAdmin, isSuper, logout, realMe, viewAs } = useAuth();
  const [picker, setPicker] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const userMode = mode === "user";
  const info = useAsync<{ contact_email: string | null; contact_phone: string | null; privacy_officer: string | null; year: number } | null>(async () => { const { data } = await db.rpc("public_info"); return (Array.isArray(data) ? data[0] : data) ?? null; }, []);
  const items = userMode ? USER_NAV : isSuper ? SUPER_NAV : ADMIN_NAV;

  useEffect(() => {
    document.body.classList.toggle("has-tabbar", userMode);
    return () => document.body.classList.remove("has-tabbar");
  }, [userMode]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const switchMode = () => {
    const next = userMode ? "admin" : "user";
    setMode(next);
    nav(next === "admin" ? (isSuper ? "/hq" : "/admin") : "/");
  };

  return (
    <>
      <DemoBar />
      <ViewAsBar />
      <header className="hdr">
        <div className="wrap hdr-in">
          <Link to={userMode ? "/" : isSuper ? "/hq" : "/admin"} className="brand" aria-label="Read to Lead 홈"><b><Wordmark /></b><span>{userMode ? "'27 상상인그룹" : isSuper ? "총괄 관리자" : "관리자"}</span></Link>
          <nav className="nav" aria-label="주 메뉴">
            {items.map((i) => <NavLink key={i.to} to={i.to} end={(i as any).end} className={({ isActive }) => (isActive ? "active" : "")}>{i.label}</NavLink>)}
          </nav>
          <div className="hdr-tools">
            {realMe?.role === "super_admin" && !viewAs && <button className="btn sm line" onClick={() => setPicker(true)}>계정 화면 보기</button>}
            {canAdmin && me?.is_participant && (
              <button className="btn sm sec2" onClick={switchMode}>{userMode ? "관리자 모드" : "참가자 모드"}</button>
            )}
            <ThemeBtn />
            <button className="icon-btn" onClick={async () => { await logout(); nav("/login"); }} aria-label="로그아웃" title="로그아웃"><Icon.out /></button>
          </div>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="no-print">
        <div className="wrap">
          <span>배움은 생존을 위한 가장 공격적인 투자다</span>
          <span className="row" style={{ gap: "4px 14px" }}>
            {(info.data?.contact_email || info.data?.contact_phone) && <span>문의 · {[info.data?.privacy_officer, info.data?.contact_email, info.data?.contact_phone].filter(Boolean).join(" · ")}</span>}
            <Link to="/privacy">개인정보 수집·이용 안내</Link>
            <span>© {info.data?.year ?? 2027} 상상인그룹 인재경영실</span>
          </span>
        </div>
      </footer>
      {userMode && (
        <nav className="tabbar" aria-label="하단 메뉴">
          {USER_NAV.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}><i.icon />{i.label}</NavLink>)}
        </nav>
      )}
      {picker && <ViewAsPicker onClose={() => setPicker(false)} />}
    </>
  );
}
