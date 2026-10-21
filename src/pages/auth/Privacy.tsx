import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db, errMsg } from "../../lib/supabase";
import { useAuth } from "../../state/auth";
import { useAsync, useToast } from "../../components/ui";
import { DemoBar } from "../../components/Layout";

type Info = { contact_email: string | null; contact_phone: string | null; privacy_officer: string | null; retention_text: string; year: number };
export function usePublicInfo() {
  return useAsync<Info | null>(async () => { const { data } = await db.rpc("public_info"); return (Array.isArray(data) ? data[0] : data) ?? null; }, []);
}

/** 개인정보 수집·이용 안내 (초안 — [ ] 칸은 운영 설정에서 채움, 최종 문구는 인사·법무 검토) */
export function PrivacyText({ info }: { info: Info | null }) {
  const blank = (v?: string | null) => v || "[ ]";
  return (
    <div className="stack" style={{ fontSize: 14.5 }}>
      <p>상상인그룹 인재경영실은 {info?.year ?? 2027}년 리더십 2년차 독서교육(Read to Lead) 운영을 위해 아래와 같이 개인정보를 수집·이용합니다.</p>
      <div className="tbl-wrap"><table><tbody>
        <tr><th style={{ position: "static", width: 130 }}>수집 항목</th><td>소속 계열사, 사번, 성명, 직급 구분, 직책, 부서, 회사 메일 주소, 교육 중 작성한 내용(사전학습·발표자료·과제), 제출·출석 기록, 접속 일시</td></tr>
        <tr><th style={{ position: "static" }}>이용 목적</th><td>교육 대상자 확인과 로그인, 회차 운영(일정·그룹 편성), 제출 현황 관리와 수료 판정, 마감·미제출 안내 메일 발송, 분기별 교육 결과 보고</td></tr>
        <tr><th style={{ position: "static" }}>공개 범위</th><td>발표자료는 같은 토론 그룹 구성원에게 공개됩니다. 사전학습·과제와 개인 정보는 본인, 소속사 HR 담당자, 그룹 인재경영실만 볼 수 있습니다.</td></tr>
        <tr><th style={{ position: "static" }}>보관 기간</th><td>{blank(info?.retention_text)} 보관 후 일괄 파기합니다.</td></tr>
        <tr><th style={{ position: "static" }}>파기 방법</th><td>보관 기간이 지나면 해당 연도의 그룹·회차·제출물 데이터를 복구할 수 없도록 삭제합니다.</td></tr>
        <tr><th style={{ position: "static" }}>처리 위탁</th><td>데이터 보관: Supabase Inc.(서버 위치: 대한민국 서울 리전) · 안내 메일 발송: [메일 발송 업체]</td></tr>
        <tr><th style={{ position: "static" }}>담당·문의</th><td>{[info?.privacy_officer, info?.contact_email, info?.contact_phone].filter(Boolean).join(" · ") || "[ ]"}</td></tr>
      </tbody></table></div>
      <p className="small muted">교육 운영에 필요한 최소한의 정보만 수집하며, 교육 목적 외로 이용하지 않습니다. 열람·정정·삭제를 원하면 위 문의처로 요청할 수 있습니다.</p>
    </div>
  );
}

export default function Privacy() {
  const info = usePublicInfo();
  return (
    <>
      <DemoBar />
      <main className="wrap" style={{ maxWidth: 760, paddingTop: 40 }}>
        <div className="stack s24">
          <div className="stack s8"><span className="label">Read to Lead · 리더십 2년차 독서교육</span><h1>개인정보 수집·이용 안내</h1></div>
          <PrivacyText info={info.data ?? null} />
          <Link to="/" className="btn line" style={{ alignSelf: "flex-start" }}>돌아가기</Link>
        </div>
      </main>
    </>
  );
}

/** 첫 로그인 시 확인 */
export function Consent() {
  const { refresh, logout, me } = useAuth();
  const info = usePublicInfo();
  const toast = useToast();
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const agree = async () => {
    setBusy(true);
    try { const { error } = await db.rpc("agree_privacy"); if (error) throw error; await refresh(); nav("/", { replace: true }); }
    catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <>
      <DemoBar />
      <main className="wrap" style={{ maxWidth: 760, paddingTop: 40 }}>
        <div className="card stack s24">
          <div className="stack s8"><span className="label">처음 한 번만 확인합니다</span><h2>{me?.name}님, 개인정보 수집·이용 안내를 확인해 주세요</h2></div>
          <PrivacyText info={info.data ?? null} />
          <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />위 내용을 확인했으며, 교육 운영을 위한 개인정보 수집·이용에 동의합니다.</label>
          <div className="btns"><button className="btn" disabled={!ok || busy} onClick={agree}>확인하고 시작하기</button>
            <button className="btn ghost" onClick={async () => { await logout(); nav("/login"); }}>로그아웃</button></div>
        </div>
      </main>
    </>
  );
}
