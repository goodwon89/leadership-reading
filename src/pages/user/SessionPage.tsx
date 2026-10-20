import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { useMine } from "../../state/mine";
import { db, errMsg, must } from "../../lib/supabase";
import { dday, fmtDateTime } from "../../lib/format";
import { catLabel, FORM_LABEL, FORM_TYPES, FormType, Submission } from "../../lib/types";
import { Empty, Icon, Loading, StatusChip, useAsync, useToast } from "../../components/ui";
import SubmissionView from "../../components/SubmissionView";
import FormEditor from "./FormEditor";

type Tab = FormType | "group";

export function SessionRedirect() {
  const { me } = useAuth();
  const { tracker, loading, data } = useMine();
  if (loading && !data) return <Loading />;
  const m = tracker?.currentMonth([me!.id]);
  return m ? <Navigate to={`/session/${m}`} replace /> : <Empty>배정된 회차가 없습니다. 소속사 HR 담당자에게 문의해 주세요.</Empty>;
}

export default function SessionPage() {
  const { me } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const month = Number(useParams().month);
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "pre";
  const { data, tracker, loading, setData } = useMine();
  const [topicEdit, setTopicEdit] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data || !tracker || !me) return <Empty>데이터를 불러오지 못했습니다.</Empty>;
  const s = tracker.session(me.id, month);
  if (!s) return <Empty>{month}월 회차가 아직 만들어지지 않았습니다.</Empty>;
  const book = tracker.book(s);
  const facil = data.profiles.find((p) => p.id === s.facilitator_id);
  const iAmFacil = s.facilitator_id === me.id;
  const months = data.sessions.map((x) => x.month).sort((a, b) => a - b);
  const prev = months.filter((m) => m < month).pop(), next = months.find((m) => m > month);
  const presCell = tracker.cell(me.id, month, "presentation");
  const canSeeGroup = presCell.status === "submitted" || presCell.status === "late" || me.rank_level === "대표급" || iAmFacil;

  const onSaved = (sub: Submission) => {
    const rest = data.submissions.filter((x) => !(x.session_id === sub.session_id && x.form_type === sub.form_type && x.profile_id === sub.profile_id));
    setData({ ...data, submissions: [...rest, sub] });
  };
  const saveTopic = async () => {
    try {
      const { error } = await db.rpc("set_session_topic", { p_session: s.id, p_topic: topicEdit });
      if (error) throw error;
      setData({ ...data, sessions: data.sessions.map((x) => (x.id === s.id ? { ...x, topic: topicEdit } : x)) });
      setTopicEdit(null); toast("발제 주제를 등록했습니다.");
    } catch (e) { toast(errMsg(e), true); }
  };

  return (
    <div className="stack s24">
      <div className="row between">
        <button className="btn ghost sm" disabled={!prev} onClick={() => nav(`/session/${prev}?tab=${tab}`)}>‹ {prev ? `${prev}월` : ""}</button>
        <span className="label">{month}월 회차 · {dday(s.meet_at)}</span>
        <button className="btn ghost sm" disabled={!next} onClick={() => nav(`/session/${next}?tab=${tab}`)}>{next ? `${next}월` : ""} ›</button>
      </div>

      <section className="card stack">
        <div className="stack s8">
          <span className="label">{catLabel(book?.category)} · {book?.author}</span>
          <h1>{book?.title ?? "도서 미편성"}</h1>
        </div>
        <div className="grid g4" style={{ gap: 12 }}>
          <div><div className="tiny faint">토론 일시</div><b>{fmtDateTime(s.meet_at)}</b></div>
          <div><div className="tiny faint">장소</div><b>{s.place || "-"}</b>{s.online_url && <div><a className="small" href={s.online_url} target="_blank" rel="noreferrer">온라인 참여 링크</a></div>}</div>
          <div><div className="tiny faint">Facilitator</div><b>{facil?.name ?? "미지정"}</b>{iAmFacil && <span className="chip acc" style={{ marginLeft: 6 }}>나</span>}</div>
          <div><div className="tiny faint">마감</div><b className="small">사전 {fmtDateTime(s.pre_due_at)}<br />과제 {fmtDateTime(s.post_due_at)}</b></div>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <div className="stack s8">
          <div className="row between"><span className="flabel">발제 주제</span>
            {iAmFacil && topicEdit === null && <button className="btn xs line" onClick={() => setTopicEdit(s.topic ?? "")}>{s.topic ? "수정" : "등록"}</button>}</div>
          {topicEdit !== null ? (
            <div className="stack s8">
              <textarea style={{ minHeight: 80 }} value={topicEdit} onChange={(e) => setTopicEdit(e.target.value)} placeholder="이번 회차에서 함께 토론할 주제를 입력하세요." />
              <div className="btns" style={{ justifyContent: "flex-end" }}><button className="btn sm line" onClick={() => setTopicEdit(null)}>취소</button><button className="btn sm" onClick={saveTopic}>저장</button></div>
            </div>
          ) : <p>{s.topic || <span className="faint">{iAmFacil ? "Facilitator로 지정되었습니다. 발제 주제를 등록해 주세요." : "아직 등록되지 않았습니다."}</span>}</p>}
        </div>
      </section>

      <div className="tabs" role="tablist">
        {FORM_TYPES.map((f) => {
          const c = tracker.cell(me.id, month, f);
          return <button key={f} role="tab" aria-selected={tab === f} onClick={() => setSp({ tab: f })}>{FORM_LABEL[f]} <StatusChip status={c.status} overdue={c.overdue} open={c.open} optional={me.rank_level === "대표급"} /></button>;
        })}
        <button role="tab" aria-selected={tab === "group"} onClick={() => setSp({ tab: "group" })}>그룹 발표자료</button>
      </div>

      {tab !== "group" ? (
        <section className="card" key={`${s.id}-${tab}`}>
          <FormEditor me={me} session={s} form={tab} cell={tracker.cell(me.id, month, tab)} settings={data.settings} onSaved={onSaved} />
        </section>
      ) : canSeeGroup ? <GroupPresentations sessionId={s.id} peers={data.profiles} meId={me.id} facilitatorId={s.facilitator_id} />
        : <Empty>내 발표자료를 제출하면 같은 그룹 구성원의 발표자료를 볼 수 있습니다. <br /><button className="btn sm" style={{ marginTop: 12 }} onClick={() => setSp({ tab: "presentation" })}>발표자료 작성하기</button></Empty>}
    </div>
  );
}

function GroupPresentations({ sessionId, peers, meId, facilitatorId }: { sessionId: string; peers: { id: string; name: string; position: string | null }[]; meId: string; facilitatorId: string | null }) {
  const q = useAsync(() => must<Submission[]>(db.from("submissions").select("*").eq("session_id", sessionId).eq("form_type", "presentation").eq("status", "submitted")), [sessionId]);
  const [big, setBig] = useState<number | null>(null);
  useEffect(() => {
    if (big === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(null); if (e.key === "ArrowRight") setBig((b) => (b === null ? b : Math.min(b + 1, list.length - 1))); if (e.key === "ArrowLeft") setBig((b) => (b === null ? b : Math.max(b - 1, 0))); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  if (q.loading) return <Loading />;
  const order = (pid: string) => (pid === facilitatorId ? 0 : pid === meId ? 2 : 1);
  const list = (q.data ?? []).filter((x) => peers.some((p) => p.id === x.profile_id)).sort((a, b) => order(a.profile_id) - order(b.profile_id));
  const notYet = peers.filter((p) => !list.some((x) => x.profile_id === p.id));
  const who = (pid: string) => peers.find((p) => p.id === pid);
  return (
    <div className="stack">
      <div className="row between"><span className="small muted">제출 {list.length}명{notYet.length ? ` · 미제출 ${notYet.map((p) => p.name).join(", ")}` : ""}</span>
        {list.length > 0 && <button className="btn sm line" onClick={() => setBig(0)}><Icon.expand size={16} />크게 보기</button>}</div>
      {list.length === 0 && <Empty>아직 제출된 발표자료가 없습니다.</Empty>}
      <div className="grid g2">
        {list.map((x, i) => (
          <article key={x.id} className="card stack">
            <div className="row between"><b>{who(x.profile_id)?.name} <span className="faint small">{who(x.profile_id)?.position}</span></b>
              <div className="row">{x.profile_id === facilitatorId && <span className="chip acc">Facilitator</span>}{x.profile_id === meId && <span className="chip">나</span>}
                <button className="icon-btn" aria-label="크게 보기" onClick={() => setBig(i)}><Icon.expand size={16} /></button></div></div>
            <SubmissionView form="presentation" content={x.content} />
          </article>
        ))}
      </div>
      {big !== null && list[big] && (
        <div className="big-view" role="dialog" aria-modal="true">
          <div className="row between" style={{ maxWidth: 1100, margin: "0 auto 24px" }}>
            <h2>{who(list[big].profile_id)?.name} <span className="faint">{big + 1} / {list.length}</span></h2>
            <div className="btns">
              <button className="btn sec2 sm" disabled={big === 0} onClick={() => setBig(big - 1)}>이전</button>
              <button className="btn sec2 sm" disabled={big === list.length - 1} onClick={() => setBig(big + 1)}>다음</button>
              <button className="btn sm" onClick={() => setBig(null)}>닫기</button>
            </div>
          </div>
          <SubmissionView form="presentation" content={list[big].content} />
        </div>
      )}
      <p className="tiny faint">발표자료만 그룹 내에 공개됩니다. 사전학습과 과제는 본인과 관리자만 볼 수 있습니다.</p>
      <Link to="#" onClick={(e) => { e.preventDefault(); q.reload(); }} className="small">새로고침</Link>
    </div>
  );
}
