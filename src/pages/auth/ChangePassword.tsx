import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { callFn, errMsg } from "../../lib/supabase";
import { validateNewPassword } from "../../lib/account";
import { DemoBar } from "../../components/Layout";
import { useToast } from "../../components/ui";

export function PasswordForm({ onDone, forced }: { onDone: () => void; forced?: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const policy = next ? validateNewPassword(next, me?.emp_no ?? "") : null;
  const checks = [
    { ok: next.length >= 8, t: "8자 이상" },
    { ok: /[A-Za-z]/.test(next) && /[0-9]/.test(next), t: "영문·숫자 포함" },
    { ok: !!next && next !== me?.emp_no, t: "사번과 다름" },
    { ok: !!next && next !== cur, t: "현재 비밀번호와 다름" },
    { ok: !!next && next === again, t: "확인 입력 일치" },
  ];
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (policy) return setErr(policy);
    if (next !== again) return setErr("새 비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    try { await callFn("change-password", { current: cur, next }); toast("비밀번호를 변경했습니다."); onDone(); }
    catch (x: any) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="cur">현재 비밀번호</label><input id="cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        {forced && <span className="help">최초 로그인 또는 초기화 직후라면 현재 비밀번호는 본인 사번입니다.</span>}</div>
      <div className="field"><label htmlFor="next">새 비밀번호</label><input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!next && !!policy} /></div>
      <div className="field"><label htmlFor="again">새 비밀번호 확인</label><input id="again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></div>
      <div className="row" style={{ gap: 6 }}>{checks.map((c) => <span key={c.t} className={`chip ${c.ok ? "ok" : "line"}`}>{c.ok ? "✓ " : ""}{c.t}</span>)}</div>
      {err && <div className="banner bad" role="alert">{err}</div>}
      <button className="btn" disabled={busy || checks.some((c) => !c.ok) || !cur}>{busy ? "변경 중…" : "비밀번호 변경"}</button>
    </form>
  );
}

export default function ChangePassword() {
  const { me, refresh, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <DemoBar />
      <main className="wrap" style={{ maxWidth: 480, paddingTop: 56 }}>
        <div className="card stack s24">
          <div className="stack s8">
            <span className="label">보안 안내</span>
            <h2>{me?.name}님, 비밀번호를 변경해 주세요</h2>
            <p className="muted small">최초 로그인이거나 관리자가 비밀번호를 초기화했습니다. 새 비밀번호로 변경해야 플랫폼을 이용할 수 있습니다.</p>
          </div>
          <PasswordForm forced onDone={async () => { await refresh(); nav("/", { replace: true }); }} />
          <button className="btn ghost" onClick={async () => { await logout(); nav("/login"); }}>다른 계정으로 로그인</button>
        </div>
      </main>
    </>
  );
}
