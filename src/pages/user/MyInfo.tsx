import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { useMine } from "../../state/mine";
import { db, errMsg } from "../../lib/supabase";
import { ROLE_LABEL } from "../../lib/types";
import { Modal, PageHead, useToast } from "../../components/ui";
import { PasswordForm } from "../auth/ChangePassword";

export default function MyInfo() {
  const { me, company, logout, refresh } = useAuth();
  const { group } = useMine();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState(me?.notify_email ?? "");
  const [pw, setPw] = useState(false);
  if (!me) return null;
  const saveEmail = async () => {
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("메일 주소 형식을 확인해 주세요.", true);
    const { error } = await db.from("profiles").update({ notify_email: email || null }).eq("id", me.id);
    if (error) return toast(errMsg(error), true);
    await refresh(); toast("알림 메일 주소를 저장했습니다.");
  };
  const rows: [string, string][] = [
    ["소속", company?.name ?? "-"], ["사번", me.emp_no], ["직급 구분", me.rank_level], ["직책", me.position ?? "-"],
    ["부서", me.department ?? "-"], ["토론 그룹", group?.name ?? "미배정"], ["권한", ROLE_LABEL[me.role]],
  ];
  return (
    <div style={{ maxWidth: 640 }}>
      <PageHead label="내 정보" title={me.name} />
      <div className="stack">
        <section className="card">
          <dl className="grid g2" style={{ margin: 0 }}>
            {rows.map(([k, v]) => <div key={k}><dt className="tiny faint">{k}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{v}</dd></div>)}
          </dl>
          <p className="tiny faint" style={{ marginTop: 16 }}>소속·직급 정보 변경은 소속사 HR 담당자에게 요청해 주세요.</p>
        </section>
        <section className="card stack">
          <h3>알림 메일</h3>
          <p className="small muted">회차 오픈, 마감 리마인드, 미제출 안내를 이 주소로 보냅니다.</p>
          <div className="inline-form">
            <div className="field"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="알림 메일 주소" /></div>
            <button className="btn" onClick={saveEmail}>저장</button>
          </div>
        </section>
        <section className="card row between">
          <div><h3>비밀번호</h3><p className="small muted">영문·숫자 포함 8자 이상</p></div>
          <button className="btn line" onClick={() => setPw(true)}>비밀번호 변경</button>
        </section>
        <div className="grid g2"><button className="btn line" onClick={() => nav("/guide")}>교육 안내</button><button className="btn line" onClick={() => nav("/privacy")}>개인정보 수집·이용 안내</button></div>
        <button className="btn sec2" onClick={async () => { await logout(); nav("/login"); }}>로그아웃</button>
      </div>
      {pw && <Modal title="비밀번호 변경" onClose={() => setPw(false)}><PasswordForm onDone={() => setPw(false)} /></Modal>}
    </div>
  );
}
