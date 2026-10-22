import { useEffect, useState } from "react";
import { AdminHead, useAdminData } from "./common";
import { db, errMsg, must } from "../../lib/supabase";
import { defaultDates, nthWeekday } from "../../lib/rules";
import { fmtDateTime, fromLocalInput, toLocalInput } from "../../lib/format";
import type { Attendance, Profile, Session, Settings } from "../../lib/types";
import { Empty, Loading, Modal, useAsync, useToast } from "../../components/ui";
import type { Tracker } from "../../lib/metrics";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function Sessions() {
  const { data, tracker, company, loading, reload } = useAdminData();
  const [gid, setGid] = useState("");
  const [edit, setEdit] = useState<Session | null>(null);
  const [att, setAtt] = useState<Session | null>(null);
  useEffect(() => { if (data && (!gid || !data.groups.some((g) => g.id === gid))) setGid(data.groups[0]?.id ?? ""); }, [data, gid]);
  if (loading && !data) return <Loading />;
  if (!data || !tracker) return <Empty>데이터를 불러오지 못했습니다.</Empty>;
  if (!data.groups.length) return <div className="stack"><AdminHead company={company} title="회차 일정·출석" /><Empty>먼저 '토론 그룹'에서 그룹을 만들어 주세요.</Empty></div>;

  const sessions = data.sessions.filter((s) => s.group_id === gid).sort((a, b) => a.month - b.month);
  const missing = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !sessions.some((s) => s.month === m));
  const members = data.profiles.filter((p) => data.members.some((m) => m.group_id === gid && m.profile_id === p.id));
  const now = new Date();

  return (
    <div className="stack s24">
      <AdminHead company={company} title="회차 일정·출석" desc="그룹별 12회차의 토론 일시·장소·Facilitator를 정합니다. 오픈·마감일은 토론일 기준으로 자동 계산되며 회차별로 조정할 수 있습니다." />
      <div className="tabs">{data.groups.map((g) => <button key={g.id} aria-selected={g.id === gid} onClick={() => setGid(g.id)}>{g.name}</button>)}</div>

      {missing.length > 0 && <Generate missing={missing} settings={data.settings} groupId={gid} onDone={reload} />}

      {sessions.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>월</th><th>도서</th><th>토론 일시</th><th>장소</th><th>Facilitator</th><th>발제</th><th>사전 마감</th><th>과제 마감</th><th>상태</th><th className="r">관리</th></tr></thead>
            <tbody>
              {sessions.map((s) => {
                const b = tracker.book(s), f = data.profiles.find((p) => p.id === s.facilitator_id);
                const state = now < new Date(s.open_at) ? ["line", "예정"] : now < new Date(s.post_due_at) ? ["acc", "진행 중"] : ["ok", "종료"];
                return (
                  <tr key={s.id}>
                    <td><b>{s.month}월</b></td>
                    <td className="small">{b?.title ?? <span className="chip warn">미편성</span>}</td>
                    <td className="nowrap">{fmtDateTime(s.meet_at)}</td>
                    <td className="small">{s.place ?? "-"}</td>
                    <td>{f?.name ?? <span className="chip warn">미지정</span>}</td>
                    <td>{s.topic ? <span className="chip ok" title={s.topic}>등록</span> : <span className="chip line">-</span>}</td>
                    <td className="small nowrap">{fmtDateTime(s.pre_due_at)}</td>
                    <td className="small nowrap">{fmtDateTime(s.post_due_at)}</td>
                    <td><span className={`chip ${state[0]}`}>{state[1]}</span></td>
                    <td className="r nowrap"><button className="btn xs ghost" onClick={() => setEdit(s)}>수정</button><button className="btn xs ghost" onClick={() => setAtt(s)}>출석</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && <EditSession s={edit} members={members} settings={data.settings} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {att && <AttendanceModal s={att} members={members} tracker={tracker} onClose={() => setAtt(null)} />}
    </div>
  );
}

function Generate({ missing, settings, groupId, onDone }: { missing: number[]; settings: Settings; groupId: string; onDone: () => void }) {
  const toast = useToast();
  const [nth, setNth] = useState(3), [wd, setWd] = useState(3), [time, setTime] = useState("15:00"), [place, setPlace] = useState(""), [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    try {
      const rows = missing.map((m) => {
        const meet = nthWeekday(settings.year, m, nth, wd, time);
        return { group_id: groupId, month: m, meet_at: meet, place: place || null, ...defaultDates(meet, settings) };
      });
      const { error } = await db.from("sessions").insert(rows); if (error) throw error;
      toast(`${rows.length}개 회차를 만들었습니다. 회차별로 일정을 조정할 수 있습니다.`); onDone();
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <section className="card stack">
      <div><h3>회차 일괄 생성</h3><p className="small muted">{settings.year}년 {missing.join(", ")}월 회차가 없습니다. 기본 규칙으로 한 번에 만든 뒤 회차별로 고칠 수 있습니다.</p></div>
      <div className="inline-form">
        <div className="field" style={{ maxWidth: 120 }}><label>매월</label><select value={nth} onChange={(e) => setNth(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}째 주</option>)}<option value={5}>마지막 주</option></select></div>
        <div className="field" style={{ maxWidth: 110 }}><label>요일</label><select value={wd} onChange={(e) => setWd(Number(e.target.value))}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}요일</option>)}</select></div>
        <div className="field" style={{ maxWidth: 130 }}><label>시간</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="field"><label>장소 (선택)</label><input type="text" value={place} onChange={(e) => setPlace(e.target.value)} /></div>
        <button className="btn" disabled={busy} onClick={gen}>{busy ? "생성 중…" : `${missing.length}개 회차 만들기`}</button>
      </div>
      <p className="tiny faint">오픈 D-{settings.open_offset_days} 09:00 · 사전학습·발표자료 마감 D-{settings.pre_due_offset_days} 23:59 · 과제 마감 D+{settings.post_due_offset_days} 23:59 (운영 설정 기준)</p>
    </section>
  );
}

function EditSession({ s, members, settings, onClose, onSaved }: { s: Session; members: Profile[]; settings: Settings; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ meet_at: toLocalInput(s.meet_at), place: s.place ?? "", online_url: s.online_url ?? "", facilitator_id: s.facilitator_id ?? "", topic: s.topic ?? "",
    open_at: toLocalInput(s.open_at), pre_due_at: toLocalInput(s.pre_due_at), post_due_at: toLocalInput(s.post_due_at) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const auto = () => { const d = defaultDates(fromLocalInput(f.meet_at), settings); setF({ ...f, open_at: toLocalInput(d.open_at), pre_due_at: toLocalInput(d.pre_due_at), post_due_at: toLocalInput(d.post_due_at) }); };
  const save = async () => {
    const r = { meet_at: fromLocalInput(f.meet_at), place: f.place || null, online_url: f.online_url || null, facilitator_id: f.facilitator_id || null, topic: f.topic || null,
      open_at: fromLocalInput(f.open_at), pre_due_at: fromLocalInput(f.pre_due_at), post_due_at: fromLocalInput(f.post_due_at) };
    if (!(r.open_at < r.pre_due_at && r.pre_due_at <= r.post_due_at)) return toast("오픈 < 사전 마감 ≤ 과제 마감 순서여야 합니다.", true);
    if (!(r.pre_due_at <= r.meet_at && r.meet_at <= r.post_due_at)) return toast("사전학습·발표 마감은 토론 전, 과제 마감은 토론 후로 정해 주세요.", true);
    const { error } = await db.from("sessions").update(r).eq("id", s.id);
    if (error) return toast(errMsg(error), true);
    toast("회차 정보를 저장했습니다."); onSaved();
  };
  return (
    <Modal wide title={`${s.month}월 회차 수정`} onClose={onClose} footer={<><button className="btn line" onClick={onClose}>취소</button><button className="btn" onClick={save}>저장</button></>}>
      <div className="stack">
        <div className="grid g2">
          <div className="field"><label>토론 일시</label><input type="datetime-local" value={f.meet_at} onChange={set("meet_at")} /></div>
          <div className="field"><label>Facilitator</label><select value={f.facilitator_id} onChange={set("facilitator_id")}><option value="">미지정</option>{members.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.position ?? p.rank_level})</option>)}</select></div>
          <div className="field"><label>장소</label><input type="text" value={f.place} onChange={set("place")} /></div>
          <div className="field"><label>온라인 링크</label><input type="url" value={f.online_url} onChange={set("online_url")} placeholder="https://" /></div>
        </div>
        <div className="field"><label>발제 주제</label><textarea style={{ minHeight: 80 }} value={f.topic} onChange={set("topic")} /><span className="help">Facilitator 본인도 참가자 화면에서 입력할 수 있습니다.</span></div>
        <div className="row between"><span className="flabel">오픈·마감</span><button className="btn xs line" onClick={auto}>토론일 기준 자동 계산</button></div>
        <div className="grid g3">
          <div className="field"><label>오픈</label><input type="datetime-local" value={f.open_at} onChange={set("open_at")} /></div>
          <div className="field"><label>사전학습·발표 마감</label><input type="datetime-local" value={f.pre_due_at} onChange={set("pre_due_at")} /></div>
          <div className="field"><label>과제 마감</label><input type="datetime-local" value={f.post_due_at} onChange={set("post_due_at")} /></div>
        </div>
        <p className="tiny faint">개인별 기한 연장은 '제출 현황'에서 합니다.</p>
      </div>
    </Modal>
  );
}

function AttendanceModal({ s, members, tracker, onClose }: { s: Session; members: Profile[]; tracker: Tracker; onClose: () => void }) {
  const toast = useToast();
  const q = useAsync(() => must<Attendance[]>(db.from("attendance").select("*").eq("session_id", s.id)), [s.id]);
  const [rows, setRows] = useState<Record<string, { status: "present" | "absent"; note: string }>>({});
  useEffect(() => { if (q.data) setRows(Object.fromEntries(members.map((p) => { const a = q.data!.find((x) => x.profile_id === p.id); return [p.id, { status: a?.status ?? "present", note: a?.note ?? "" }]; }))); }, [q.data, members]);
  const save = async () => {
    const { error } = await db.from("attendance").upsert(Object.entries(rows).map(([pid, r]) => ({ session_id: s.id, profile_id: pid, status: r.status, note: r.note || null })), { onConflict: "session_id,profile_id" });
    if (error) return toast(errMsg(error), true);
    toast("출석을 저장했습니다."); onClose();
  };
  const b = tracker.book(s);
  return (
    <Modal wide title={`${s.month}월 출석 · ${b?.title ?? ""}`} onClose={onClose} footer={<><button className="btn line" onClick={onClose}>취소</button><button className="btn" onClick={save}>저장</button></>}>
      {q.loading ? <Loading /> : (
        <div className="stack s8">
          <p className="small muted">출석은 기록용이며 현재 수료 조건에는 포함되지 않습니다.</p>
          {members.map((p) => (
            <div key={p.id} className="row nowrap" style={{ borderBottom: "1px solid var(--subtle)", paddingBottom: 8 }}>
              <b style={{ minWidth: 90 }}>{p.name}</b>
              <div className="row nowrap" style={{ gap: 4 }}>
                {(["present", "absent"] as const).map((st) => (
                  <button key={st} className={`btn xs ${rows[p.id]?.status === st ? "" : "line"}`} onClick={() => setRows({ ...rows, [p.id]: { ...rows[p.id], status: st } })}>{st === "present" ? "참석" : "불참"}</button>
                ))}
              </div>
              <input type="text" placeholder="사유 (선택)" value={rows[p.id]?.note ?? ""} onChange={(e) => setRows({ ...rows, [p.id]: { ...rows[p.id], note: e.target.value } })} style={{ minHeight: 34, padding: "4px 10px" }} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
