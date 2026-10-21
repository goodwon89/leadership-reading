import { Link } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { useMine } from "../../state/mine";
import { catLabel, FORM_LABEL, FORM_TYPES } from "../../lib/types";
import { dday, fmtDateTime, remaining, coverUrl } from "../../lib/format";
import { TOTAL_FORMS } from "../../lib/metrics";
import { Bar, BookCover, Empty, Loading, StatusChip } from "../../components/ui";

export default function Home() {
  const { me, company } = useAuth();
  const { data, tracker, group, error, loading } = useMine();
  if (loading && !data) return <Loading />;
  if (error || !data || !tracker || !me) return <Empty>데이터를 불러오지 못했습니다. {error}</Empty>;

  const rep = me.rank_level === "대표급";
  const month = tracker.currentMonth([me.id]);
  const s = month ? tracker.session(me.id, month) : null;
  const book = tracker.book(s);
  const facil = data.profiles.find((p) => p.id === s?.facilitator_id);
  const person = tracker.person(me.id);
  const now = new Date();
  const soon = s && !rep ? FORM_TYPES.map((f) => ({ f, c: tracker.cell(me.id, s.month, f) }))
    .filter(({ c }) => c.open && c.due && (c.status === "none" || c.status === "draft") && !c.overdue && new Date(c.due).getTime() - now.getTime() < 3 * 86400000) : [];
  const overdue: { m: number; f: (typeof FORM_TYPES)[number] }[] = [];
  if (!rep) for (let m = 1; m <= 12; m++) for (const f of FORM_TYPES) if (tracker.cell(me.id, m, f).overdue) overdue.push({ m, f });

  return (
    <div className="stack s32">
      <div className="stack s8">
        <span className="label">{company?.name} · {group?.name ?? "그룹 미배정"} · {me.position ?? me.rank_level}</span>
        <h1>{me.name}님, 이번 달도 함께 읽어요</h1>
      </div>

      {!group && <Empty>아직 토론 그룹이 배정되지 않았습니다. 소속사 HR 담당자에게 문의해 주세요.</Empty>}

      {soon.length > 0 && (
        <div className="banner warn"><span className="grow">{soon.map((x) => FORM_LABEL[x.f]).join("·")} 마감이 다가옵니다 · {remaining(soon[0].c.due!)}</span>
          <Link className="btn sm" to={`/session/${s!.month}`}>작성하기</Link></div>
      )}
      {overdue.length > 0 && (
        <div className="banner bad"><span className="grow">미제출 {overdue.length}건 — {overdue.slice(0, 3).map((o) => `${o.m}월 ${FORM_LABEL[o.f]}`).join(", ")}{overdue.length > 3 ? " 외" : ""}. 지금 제출하면 지연 제출로 기록되며 수료에 인정됩니다.</span>
          <Link className="btn sm line" to={`/session/${overdue[0].m}`}>제출하기</Link></div>
      )}

      {s && book && (
        <section className="card">
          <div className="hero">
            <div className="stack">
              <span className="label">{s.month}월의 책 · {catLabel(book.category)}</span>
              <h2 className="display">{book.title}</h2>
              <p className="muted">{book.author}</p>
              <p className="lead">{book.summary}</p>
              {book.recommended_by && <div><span className="chip acc">{book.recommended_by}</span></div>}
            </div>
            <div className="row" style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
              <BookCover title={book.title} author={book.author} category={book.category} url={coverUrl(book)} />
            </div>
          </div>
        </section>
      )}

      {s && (
        <div className="grid g2">
          <section className="card stack">
            <div className="card-h" style={{ marginBottom: 0 }}><h3>토론 일정</h3><span className="chip acc">{dday(s.meet_at)}</span></div>
            <dl className="pres">
              <div><dt>일시</dt><dd>{fmtDateTime(s.meet_at)}</dd></div>
              <div><dt>장소</dt><dd>{s.place || "-"}{s.online_url && <> · <a href={s.online_url} target="_blank" rel="noreferrer">온라인 참여</a></>}</dd></div>
              <div><dt>Facilitator</dt><dd>{facil ? `${facil.name} ${facil.position ?? ""}` : "미지정"}{facil?.id === me.id && <span className="chip acc" style={{ marginLeft: 6 }}>내가 진행</span>}</dd></div>
              <div><dt>발제 주제</dt><dd>{s.topic || <span className="faint">아직 등록되지 않았습니다.</span>}</dd></div>
            </dl>
          </section>
          <section className="card stack">
            <div className="card-h" style={{ marginBottom: 0 }}><h3>이번 회차 제출</h3>{rep && <span className="chip line">대표급 · 선택 입력</span>}</div>
            {FORM_TYPES.map((f) => {
              const c = tracker.cell(me.id, s.month, f);
              return (
                <Link key={f} to={`/session/${s.month}?tab=${f}`} className="row between nowrap" style={{ textDecoration: "none", padding: "10px 0", borderBottom: "1px solid var(--subtle)" }}>
                  <div className="stack s8" style={{ gap: 2 }}>
                    <b>{FORM_LABEL[f]}</b>
                    <span className="tiny faint">{!c.open ? `${fmtDateTime(s.open_at)} 오픈` : `마감 ${fmtDateTime(c.due)}${c.extended ? " (연장)" : ""}`}</span>
                  </div>
                  <StatusChip status={c.status} overdue={c.overdue} open={c.open} optional={rep} />
                </Link>
              );
            })}
            <Link to={`/session/${s.month}`} className="btn">회차 바로가기</Link>
          </section>
        </div>
      )}

      {!rep && group && (
        <section className="card stack">
          <div className="row between"><h3>수료 진행률</h3><span className="num"><b style={{ fontSize: 22 }}>{person.submitted}</b><span className="faint"> / {TOTAL_FORMS}건</span></span></div>
          <Bar value={person.submitted / TOTAL_FORMS} />
          <p className="small muted">12회 × 3개 양식(사전학습·발표자료·과제) = 36건을 모두 제출하면 수료합니다. 지연 제출도 수료에 인정됩니다.{person.late > 0 && ` 지연 제출 ${person.late}건.`}</p>
          <Link to="/library" className="btn line sm" style={{ alignSelf: "flex-start" }}>내 서재에서 전체 보기</Link>
        </section>
      )}
      <Link to="/guide" className="card tight row between" style={{ textDecoration: "none" }}>
        <span><b>교육 안내</b> <span className="small muted">운영 개요 · 과제 제출 단계 · 도서 목록 12권</span></span><span className="small" style={{ color: "var(--link)" }}>보기 ›</span>
      </Link>
      {rep && <p className="small muted">대표급은 과제 제출 대상이 아닙니다. 도서·일정을 확인하고, 원하시면 양식을 자유롭게 작성하실 수 있습니다.</p>}
    </div>
  );
}
