import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { callFn, db, DEMO, errMsg } from "../../lib/supabase";
import { demoAccounts, demoPasswordOf } from "../../lib/demo/client";
import { DemoBar } from "../../components/Layout";
import { Wordmark, useToast } from "../../components/ui";

export default function Login() {
  const { me, login } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [companies, setCompanies] = useState<{ code: string; name: string }[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [code, setCode] = useState(() => { try { return localStorage.getItem("lr-last-company") ?? ""; } catch { return ""; } });
  const [emp, setEmp] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    db.rpc("login_companies").then(({ data }: any) => setCompanies(data ?? []));
    db.rpc("needs_setup").then(({ data }: any) => setNeedsSetup(!!data));
  }, []);

  if (me) return <Navigate to={me.must_change_password ? "/change-password" : "/"} replace />;

  const doLogin = async (c: string, e: string, p: string) => {
    setErr(""); setBusy(true);
    try {
      await login(c, e, p);
      try { localStorage.setItem("lr-last-company", c); } catch { /* ignore */ }
      nav("/", { replace: true });
    } catch (x: any) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!code) return setErr("계열사를 선택하세요.");
    if (!emp.trim() || !pw) return setErr("사번과 비밀번호를 입력하세요.");
    doLogin(code, emp, pw);
  };

  if (needsSetup && !DEMO) return <Setup onDone={() => { setNeedsSetup(false); toast("초기 설정이 완료되었습니다. 사번으로 로그인하세요."); db.rpc("login_companies").then(({ data }: any) => setCompanies(data ?? [])); }} />;

  return (
    <>
      <DemoBar />
      <div className="auth-wrap">
        <section className="auth-side">
          <div className="stack" style={{ gap: 2 }}>
            <span className="label" style={{ color: "var(--accent)" }}>상상인그룹 인재경영실</span>
            <span style={{ fontWeight: 700, opacity: .7 }}>'27 리더십 2년차 독서교육</span>
          </div>
          <div className="stack s24">
            <h1 className="display brand-display"><Wordmark /></h1>
            <p className="steps">지정도서 완독 › 인사이트 공유 › 과제 제출</p>
            <p className="lead">배움은 생존을 위한 가장 공격적인 투자다</p>
          </div>
          <p style={{ opacity: .6, fontSize: 13 }}>2027년 1~12월 · 월 1회 · 총 12회 · 85명</p>
        </section>
        <section className="auth-main">
          <div className="stack s8">
            <h2>로그인</h2>
            <p className="muted small">계열사를 선택하고 사번으로 로그인하세요. 최초 비밀번호는 본인 사번입니다.</p>
          </div>
          <form className="stack" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="company">계열사</label>
              <select id="company" value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">선택하세요</option>
                {companies.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="emp">사번</label>
              <input id="emp" type="text" inputMode="text" autoComplete="username" value={emp} onChange={(e) => setEmp(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pw">비밀번호</label>
              <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            {err && <div className="banner bad" role="alert">{err}</div>}
            <button className="btn block" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
            <button type="button" className="btn ghost" onClick={() => setForgot(!forgot)}>비밀번호를 잊으셨나요?</button>
            <p className="tiny faint" style={{ textAlign: "center" }}><Link to="/privacy">개인정보 수집·이용 안내</Link> · © 2027 상상인그룹 인재경영실</p>
            {forgot && <div className="banner info">소속사 HR 담당자에게 비밀번호 초기화를 요청하세요. 초기화하면 비밀번호가 다시 사번으로 바뀝니다.</div>}
          </form>
          {DEMO && (
            <div className="card flat tight stack s8">
              <span className="label">데모 계정으로 둘러보기</span>
              <div className="grid g3" style={{ gap: 8 }}>
                {demoAccounts().map((a) => (
                  <button key={a.label} className="btn sec2 sm" disabled={busy} onClick={() => doLogin(a.code, a.emp, demoPasswordOf(a.code, a.emp))}>{a.label}</button>
                ))}
              </div>
              <p className="tiny faint">최초 비밀번호 변경 화면은 A사 · 사번 1002 · 비밀번호 1002 로 확인할 수 있습니다.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ setup_code: "", company_code: "", company_name: "", emp_no: "", name: "", notify_email: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!/^[A-Za-z0-9]{1,10}$/.test(f.company_code)) return setErr("계열사 코드는 영문·숫자 10자 이내로 입력하세요.");
    if (!f.setup_code || !f.company_name || !f.emp_no || !f.name) return setErr("필수 항목을 모두 입력하세요.");
    setBusy(true);
    try { await callFn("admin-users", { action: "bootstrap", ...f }); onDone(); } catch (x: any) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <main className="wrap" style={{ maxWidth: 520, paddingTop: 64 }}>
      <form className="card stack" onSubmit={submit}>
        <span className="label">최초 1회</span>
        <h2>초기 설정 — 총괄 관리자 등록</h2>
        <p className="muted small">아직 총괄 관리자가 없습니다. 인재경영실 담당자 계정을 만들면 이 화면은 다시 나타나지 않습니다.</p>
        <div className="field"><label>설치 코드</label><input type="password" value={f.setup_code} onChange={set("setup_code")} autoComplete="off" /><span className="help">Supabase 서버 함수 환경변수 BOOTSTRAP_CODE 에 넣은 값입니다. 이 코드를 아는 사람만 총괄 관리자를 만들 수 있습니다.</span></div>
        <div className="grid g2">
          <div className="field"><label>계열사 코드</label><input type="text" value={f.company_code} onChange={set("company_code")} placeholder="예: SSI" /><span className="help">로그인 계정에 쓰이며 이후 변경하지 않습니다.</span></div>
          <div className="field"><label>계열사 이름</label><input type="text" value={f.company_name} onChange={set("company_name")} placeholder="예: 상상인" /></div>
          <div className="field"><label>사번</label><input type="text" value={f.emp_no} onChange={set("emp_no")} /></div>
          <div className="field"><label>성명</label><input type="text" value={f.name} onChange={set("name")} /></div>
        </div>
        {err && <div className="banner bad">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? "등록 중…" : "총괄 관리자 등록"}</button>
        <p className="tiny faint">등록 후 최초 비밀번호는 입력한 사번이며, 첫 로그인 때 변경합니다.</p>
      </form>
    </main>
  );
}
