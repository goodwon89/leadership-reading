import { useState } from "react";
import { AdminHead, useAdminData } from "./common";
import NudgeModal from "./Nudge";
import { db, errMsg, must } from "../../lib/supabase";
import { isRequired, Tracker } from "../../lib/metrics";
import { fmtDateTime, fromLocalInput, toLocalInput } from "../../lib/format";
import { FORM_LABEL, FORM_TYPES, FormType, Profile, Submission } from "../../lib/types";
import { dotClass, Empty, Loading, Modal, StatusChip, useAsync, useToast } from "../../components/ui";
import SubmissionView from "../../components/SubmissionView";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Submissions() {
  const { data, tracker, company, loading, reload } = useAdminData();
  const [gid, setGid] = useState("");
  const [onlyReq, setOnlyReq] = useState(true);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [detail, setDetail] = useState<{ p: Profile; m: number } | null>(null);
  const [nudgeMonth, setNudgeMonth] = useState<number | null>(null);
  if (loading && !data) return <Loading />;
  if (!data || !tracker) return <Empty>데이터를 불러오지 못했습니다.</Empty>;

  const people = data.profiles.filter((p) => p.is_active && p.is_participant)
    .filter((p) => !onlyReq || isRequired(p))
    .filter((p) => !gid || tracker.group(p.id) === gid)
    .filter((p) => !onlyRisk || tracker.person(p.id).atRisk)
    .sort((a, b) => (tracker.group(a.id) ?? "").localeCompare(tracker.group(b.id) ?? "") || a.emp_no.localeCompare(b.emp_no));
  const cur = tracker.currentMonth(people.map((p) => p.id));
  const pendingOf = (m: number) => people.filter((p) => isRequired(p) && FORM_TYPES.some((f) => { const c = tracker.cell(p.id, m, f); return c.open && c.status !== "submitted" && c.status !== "late"; }));

  return (
    <div className="stack s24">
      <AdminHead company={company} title="제출 현황" desc="칸을 누르면 제출물을 보고, 개인별 기한 연장·잠금 해제를 할 수 있습니다." right={
        <select value={nudgeMonth ?? ""} onChange={(e) => setNudgeMonth(e.target.value ? Number(e.target.value) : null)} style={{ width: "auto" }} aria-label="독려 메일 월 선택">
          <option value="">독려 메일 보내기…</option>{MONTHS.filter((m) => pendingOf(m).length).map((m) => <option key={m} value={m}>{m}월 미제출 {pendingOf(m).length}명</option>)}
        </select>} />
      <div className="row">
        <select value={gid} onChange={(e) => setGid(e.target.value)} style={{ width: "auto" }}><option value="">전체 그룹</option>{data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <label className="check"><input type="checkbox" checked={onlyReq} onChange={(e) => setOnlyReq(e.target.checked)} />과제 대상(본부장·팀장급)만</label>
        <label className="check"><input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />수료 위험자만</label>
        <div className="spacer" />
        <span className="row tiny faint" style={{ gap: 10 }}>
          <span className="row" style={{ gap: 4 }}><span className="dot ok" />제출</span><span className="row" style={{ gap: 4 }}><span className="dot warn" />지연·임시저장</span>
          <span className="row" style={{ gap: 4 }}><span className="dot bad" />미제출(마감 경과)</span><span className="row" style={{ gap: 4 }}><span className="dot none" />미작성·예정</span>
          <span>점 순서: 사전학습·발표·과제</span>
        </span>
      </div>

      <div className="tbl-wrap">
        <table className="mx">
          <thead><tr><th>성명</th><th>그룹</th>{MONTHS.map((m) => <th key={m} className="c" style={m === cur ? { color: "var(--accent-strong)" } : undefined}>{m}월</th>)}<th className="r">제출</th><th className="r">미제출</th></tr></thead>
          <tbody>
            {people.map((p) => {
              const s = tracker.person(p.id);
              return (
                <tr key={p.id}>
                  <td className="nowrap"><b>{p.name}</b> <span className="tiny faint">{p.rank_level === "대표급" ? "대표급" : ""}</span></td>
                  <td className="small nowrap">{data.groups.find((g) => g.id === tracker.group(p.id))?.name ?? "-"}</td>
                  {MONTHS.map((m) => (
                    <td key={m} className="c">
                      <button className="cell" onClick={() => setDetail({ p, m })} aria-label={`${p.name} ${m}월`} disabled={!tracker.session(p.id, m)}>
                        {FORM_TYPES.map((f) => { const c = tracker.cell(p.id, m, f); return <span key={f} className={`dot ${dotClass(c.status, c.overdue && isRequired(p), c.open)}`} style={c.extended ? { outline: "2px solid var(--accent)", outlineOffset: 1 } : undefined} />; })}
                      </button>
                    </td>
                  ))}
                  <td className="r num">{s.submitted}/36</td>
                  <td className="r">{s.overdue > 0 && isRequired(p) ? <span className="chip bad">{s.overdue}</span> : <span className="faint">0</span>}</td>
                </tr>
              );
            })}
            {people.length === 0 && <tr><td colSpan={16}><Empty>해당하는 사람이 없습니다.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="tiny faint">테두리가 있는 점은 개인 기한이 연장된 양식입니다.</p>

      {detail && <Detail p={detail.p} m={detail.m} tracker={tracker} onClose={() => setDetail(null)} onChanged={reload} />}
      {nudgeMonth && <NudgeModal people={pendingOf(nudgeMonth)} onClose={() => setNudgeMonth(null)} subject={`[Read to Lead] ${nudgeMonth}월 회차 제출 안내`}
        message={`{name}님, 안녕하세요.\n${nudgeMonth}월 회차 양식 중 아직 제출되지 않은 항목이 있습니다.\n12회 전 회차를 모두 제출해야 수료할 수 있으니 플랫폼에서 확인 부탁드립니다.`} />}
    </div>
  );
}

function Detail({ p, m, tracker, onClose, onChanged }: { p: Profile; m: number; tracker: Tracker; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const q = useAsync(() => must<Submission[]>(db.from("submissions").select("*").eq("profile_id", p.id).eq("month", m)), [p.id, m]);
  const [tab, setTab] = useState<FormType>("pre");
  const [ext, setExt] = useState<{ due: string; reason: string } | null>(null);
  const s = tracker.session(p.id, m)!;
  const c = tracker.cell(p.id, m, tab);
  const book = tracker.book(s);
  const full = q.data?.find((x) => x.form_type === tab);

  const saveExt = async () => {
    if (!ext?.due || !ext.reason.trim()) return toast("새 마감 일시와 사유를 입력하세요.", true);
    const { error } = await db.from("deadline_overrides").upsert({ session_id: s.id, profile_id: p.id, form_type: tab, new_due_at: fromLocalInput(ext.due), reason: ext.reason.trim() }, { onConflict: "session_id,profile_id,form_type" });
    if (error) return toast(errMsg(error), true);
    toast("기한을 연장했습니다. 감사 로그에 기록됩니다."); setExt(null); onChanged(); onClose();
  };
  const unlockDefault = () => toLocalInput(new Date(Date.now() + 3 * 86400000).toISOString());

  return (
    <Modal wide title={`${p.name} · ${m}월 《${book?.title ?? ""}》`} onClose={onClose}>
      <div className="stack">
        <div className="tabs">{FORM_TYPES.map((f) => { const x = tracker.cell(p.id, m, f); return <button key={f} aria-selected={tab === f} onClick={() => { setTab(f); setExt(null); }}>{FORM_LABEL[f]} <StatusChip status={x.status} overdue={x.overdue} open={x.open} /></button>; })}</div>
        <div className="row between small">
          <span>마감 {fmtDateTime(c.due)}{c.extended && <span className="chip acc" style={{ marginLeft: 6 }}>연장됨</span>}</span>
          <span className="faint">{full?.submitted_at ? `제출 ${fmtDateTime(full.submitted_at)}${full.is_late ? " (지연)" : ""}` : full ? `임시저장 ${fmtDateTime(full.updated_at)}` : "작성 기록 없음"}</span>
        </div>
        {q.loading ? <Loading /> : <div className="card flat"><SubmissionView form={tab} content={full?.status === "submitted" || full ? full?.content : null} /></div>}
        {full && full.status === "draft" && <p className="tiny faint">임시저장 상태로, 제출로 인정되지 않습니다.</p>}

        {!ext ? (
          <div className="row">
            <button className="btn sm line" onClick={() => setExt({ due: unlockDefault(), reason: "" })}>
              {full?.status === "submitted" && c.due && new Date(c.due) < new Date() ? "잠금 해제(수정 허용)" : "개별 기한 연장"}</button>
            <span className="tiny faint">새 마감까지 본인이 작성·수정할 수 있으며, 그 안에 제출하면 기한 내 제출로 처리됩니다.</span>
          </div>
        ) : (
          <div className="card flat stack s8">
            <div className="inline-form">
              <div className="field"><label>새 마감 일시</label><input type="datetime-local" value={ext.due} onChange={(e) => setExt({ ...ext, due: e.target.value })} /></div>
              <div className="field" style={{ flex: 2 }}><label>사유 (감사 로그에 기록)</label><input type="text" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} placeholder="예: 출장으로 인한 연장" /></div>
            </div>
            <div className="btns" style={{ justifyContent: "flex-end" }}><button className="btn sm line" onClick={() => setExt(null)}>취소</button><button className="btn sm" onClick={saveExt}>적용</button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
