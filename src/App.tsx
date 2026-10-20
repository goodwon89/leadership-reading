import { ReactNode } from "react";
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import Privacy, { Consent } from "./pages/auth/Privacy";
import { AuthProvider, useAuth } from "./state/auth";
import { Loading, ToastProvider } from "./components/ui";
import Layout, { SINGLE } from "./components/Layout";
import Login from "./pages/auth/Login";
import ChangePassword from "./pages/auth/ChangePassword";
import Home from "./pages/user/Home";
import SessionPage, { SessionRedirect } from "./pages/user/SessionPage";
import Library from "./pages/user/Library";
import MyInfo from "./pages/user/MyInfo";
import Guide from "./pages/user/Guide";
import AdminDashboard from "./pages/admin/Dashboard";
import Members from "./pages/admin/Members";
import Groups from "./pages/admin/Groups";
import CurriculumPage from "./pages/admin/Curriculum";
import Sessions from "./pages/admin/Sessions";
import Submissions from "./pages/admin/Submissions";
import ExportPage from "./pages/admin/Export";
import HqDashboard from "./pages/hq/Dashboard";
import Insights from "./pages/hq/Insights";
import Report from "./pages/hq/Report";
import HqSettings from "./pages/hq/Settings";

function Guard({ children, admin, superOnly, anyMode }: { children: ReactNode; admin?: boolean; superOnly?: boolean; anyMode?: boolean }) {
  const { ready, me, canAdmin, isSuper, mode } = useAuth();
  if (!ready) return <div className="wrap" style={{ paddingTop: 64 }}><Loading /></div>;
  if (!me) return <Navigate to="/login" replace />;
  if (me.must_change_password) return <Navigate to="/change-password" replace />;
  if (!me.privacy_agreed_at) return <Navigate to="/consent" replace />;
  if (superOnly && !isSuper) return <Navigate to="/" replace />;
  if (admin && !canAdmin) return <Navigate to="/" replace />;
  if (!admin && !anyMode && mode === "admin") return <Navigate to={isSuper ? "/hq" : "/admin"} replace />;
  return <Layout>{children}</Layout>;
}

function Forced() {
  const { ready, me } = useAuth();
  if (!ready) return <Loading />;
  if (!me) return <Navigate to="/login" replace />;
  return <ChangePassword />;
}

function ConsentRoute() {
  const { ready, me } = useAuth();
  if (!ready) return <Loading />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.must_change_password) return <Navigate to="/change-password" replace />;
  if (me.privacy_agreed_at) return <Navigate to="/" replace />;
  return <Consent />;
}

/** 화면마다 브라우저 탭 제목 */
const TITLES: [RegExp, string][] = [
  [/^\/login/, "로그인"], [/^\/change-password/, "비밀번호 변경"], [/^\/consent/, "개인정보 확인"], [/^\/privacy/, "개인정보 수집·이용 안내"],
  [/^\/session/, "이번 회차"], [/^\/library/, "내 서재"], [/^\/me/, "내 정보"], [/^\/guide/, "교육 안내"],
  [/^\/admin\/members/, "대상자 관리"], [/^\/admin\/groups/, "토론 그룹"], [/^\/admin\/curriculum/, "도서 편성"], [/^\/admin\/sessions/, "회차·출석"],
  [/^\/admin\/submissions/, "제출 현황"], [/^\/admin\/export/, "내보내기"], [/^\/admin/, "관리자 대시보드"],
  [/^\/hq\/insights/, "인사이트"], [/^\/hq\/report/, "분기 보고"], [/^\/hq\/settings/, "설정"], [/^\/hq/, "그룹 대시보드"],
];
function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "홈";
    document.title = `${t} · 리더십 2년차 독서교육`;
  }, [pathname]);
  return null;
}

function AdminArea({ children, superOnly }: { children: ReactNode; superOnly?: boolean }) {
  return <Guard admin superOnly={superOnly}><AdminMode>{children}</AdminMode></Guard>;
}
/** 관리자 화면에 들어오면 관리자 모드로 전환 */
function AdminMode({ children }: { children: ReactNode }) {
  const { mode, setMode } = useAuth();
  if (mode !== "admin") { setTimeout(() => setMode("admin"), 0); }
  return <>{children}</>;
}

// 단일 파일 데모(아티팩트)는 주소 변경이 막힌 프레임에서 실행되므로 메모리 라우터 사용
const Router = SINGLE ? MemoryRouter : HashRouter;

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <TitleSync />
          <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/consent" element={<ConsentRoute />} />
            <Route path="/change-password" element={<Forced />} />
            <Route path="/" element={<Guard><Home /></Guard>} />
            <Route path="/session" element={<Guard><SessionRedirect /></Guard>} />
            <Route path="/session/:month" element={<Guard><SessionPage /></Guard>} />
            <Route path="/library" element={<Guard><Library /></Guard>} />
            <Route path="/me" element={<Guard><MyInfo /></Guard>} />
            <Route path="/guide" element={<Guard anyMode><Guide /></Guard>} />
            <Route path="/admin" element={<AdminArea><AdminDashboard /></AdminArea>} />
            <Route path="/admin/members" element={<AdminArea><Members /></AdminArea>} />
            <Route path="/admin/groups" element={<AdminArea><Groups /></AdminArea>} />
            <Route path="/admin/curriculum" element={<AdminArea><CurriculumPage /></AdminArea>} />
            <Route path="/admin/sessions" element={<AdminArea><Sessions /></AdminArea>} />
            <Route path="/admin/submissions" element={<AdminArea><Submissions /></AdminArea>} />
            <Route path="/admin/export" element={<AdminArea><ExportPage /></AdminArea>} />
            <Route path="/hq" element={<AdminArea superOnly><HqDashboard /></AdminArea>} />
            <Route path="/hq/insights" element={<AdminArea superOnly><Insights /></AdminArea>} />
            <Route path="/hq/report" element={<AdminArea superOnly><Report /></AdminArea>} />
            <Route path="/hq/settings" element={<AdminArea superOnly><HqSettings /></AdminArea>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}
