import { Link } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { useMine } from "../../state/mine";
import { catLabel, FORM_LABEL, FORM_TYPES } from "../../lib/types";
import { fmtDate } from "../../lib/format";
import { Empty, Loading, PageHead, dotClass } from "../../components/ui";

export default function Library() {
  const { me } = useAuth();
  const { data, tracker, loading } = useMine();
  if (loading && !data) return <Loading />;
  if (!data || !tracker || !me) return <Empty>데이터를 불러오지 못했습니다.</Empty>;
  const current = tracker.currentMonth([me.id]);
  const p = tracker.person(me.id);
  const rep = me.rank_level === "대표급";
  return (
    <div>
      <PageHead label="내 서재" title="올해의 12권" desc={rep ? "도서와 회차별 기록을 확인하세요." : `제출 ${p.submitted}/36건 · 지연 ${p.late}건 · 미제출 ${p.overdue}건`} />
      <div className="months">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const s = tracker.session(me.id, m);
          const b = tracker.book(s);
          const cells = FORM_TYPES.map((f) => tracker.cell(me.id, m, f));
          const done = cells.every((c) => c.status === "submitted" || c.status === "late");
          const open = cells[0].open;
          const label = !s ? "미편성" : done ? "완료" : open ? (cells.some((c) => c.overdue) && !rep ? "미제출 있음" : "진행 중") : "예정";
          const cls = done ? "ok" : !open ? "line" : cells.some((c) => c.overdue) && !rep ? "bad" : "acc";
          return (
            <Link key={m} to={s ? `/session/${m}` : "#"} className={`mcard${m === current ? " now" : ""}`}>
              <div className="row between"><span className="m">{m}월{s ? ` · ${fmtDate(s.meet_at)}` : ""}</span><span className={`chip ${cls}`}>{label}</span></div>
              <b>{b?.title ?? "-"}</b>
              <span className="tiny faint">{catLabel(b?.category)} · {b?.author}</span>
              <div className="spacer" />
              <div className="row" style={{ gap: 10 }}>
                {FORM_TYPES.map((f, i) => <span key={f} className="row tiny faint" style={{ gap: 4 }}><span className={`dot ${dotClass(cells[i].status, cells[i].overdue && !rep, cells[i].open)}`} />{FORM_LABEL[f]}</span>)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
