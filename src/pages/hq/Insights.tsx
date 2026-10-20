import { useMemo, useState } from "react";
import { useHqData } from "./common";
import { fetchContents } from "../../lib/reports";
import { Empty, Loading, PageHead, useAsync } from "../../components/ui";
import type { Submission } from "../../lib/types";

type Kind = "summary" | "quotes" | "insight" | "application";
const KINDS: { k: Kind; label: string }[] = [
  { k: "summary", label: "사전학습 요약" }, { k: "quotes", label: "인용구절" }, { k: "insight", label: "과제 인사이트" }, { k: "application", label: "현업 적용점" },
];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Insights() {
  const { data, tracker, loading } = useHqData();
  const subs = useAsync(() => fetchContents(null, MONTHS), []);
  const [kind, setKind] = useState<Kind>("insight");
  const [cid, setCid] = useState("");
  const [bookId, setBookId] = useState("");
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    if (!tracker || !subs.data) return [];
    const form = kind === "summary" || kind === "quotes" ? "pre" : kind === "insight" ? "post" : "presentation";
    return subs.data.filter((s) => s.status === "submitted" && s.form_type === form).map((s: Submission) => {
      const sess = tracker.ds.sessions.find((x) => x.id === s.session_id) ?? null;
      const book = tracker.book(sess);
      const p = tracker.ds.profiles.find((x) => x.id === s.profile_id);
      const texts: string[] = kind === "quotes" ? (s.content?.quotes ?? []).map((x: any) => x.text).filter(Boolean)
        : [s.content?.[kind === "summary" ? "summary" : kind === "insight" ? "insight" : "application"] ?? ""];
      return { s, book, p, company: tracker.ds.companies.find((c) => c.id === s.company_id), texts };
    }).filter((x) => (!cid || x.s.company_id === cid) && (!bookId || String(x.book?.id) === bookId) && (!q || x.texts.some((t) => t.includes(q)) || x.p?.name.includes(q)));
  }, [tracker, subs.data, kind, cid, bookId, q]);

  const topQuotes = useMemo(() => {
    if (kind !== "quotes") return [];
    const cnt = new Map<string, { text: string; n: number; book?: string }>();
    items.forEach((x) => x.texts.forEach((t) => {
      const key = t.replace(/[\s"'“”‘’.,·]/g, "");
      const cur = cnt.get(key) ?? { text: t, n: 0, book: x.book?.title };
      cur.n++; cnt.set(key, cur);
    }));
    return [...cnt.values()].filter((x) => x.n > 1).sort((a, b) => b.n - a.n).slice(0, 10);
  }, [items, kind]);

  if ((loading && !data) || subs.loading) return <Loading />;
  if (!data || !tracker) return <Empty>데이터를 불러오지 못했습니다.</Empty>;

  return (
    <div className="stack s24">
      <PageHead label="총괄 관리자" title="인사이트 모아보기" desc="리더들이 제출한 요약·인용·인사이트를 도서·계열사별로 모아 봅니다." />
      <div className="tabs">{KINDS.map((x) => <button key={x.k} aria-selected={kind === x.k} onClick={() => setKind(x.k)}>{x.label}</button>)}</div>
      <div className="row">
        <select value={cid} onChange={(e) => setCid(e.target.value)} style={{ width: "auto" }}><option value="">전체 계열사</option>{data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={bookId} onChange={(e) => setBookId(e.target.value)} style={{ width: "auto" }}><option value="">전체 도서</option>{data.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>
        <input type="search" placeholder="키워드·이름 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <span className="small faint">{items.length}건</span>
      </div>

      {kind === "quotes" && topQuotes.length > 0 && (
        <section className="card">
          <h3 style={{ marginBottom: 12 }}>자주 인용된 구절 Top {topQuotes.length}</h3>
          <ol className="stack s8" style={{ margin: 0, paddingLeft: 20 }}>
            {topQuotes.map((t, i) => <li key={i}><span>{t.text}</span> <span className="tiny faint">· {t.book} · {t.n}회</span></li>)}
          </ol>
        </section>
      )}

      {items.length === 0 ? <Empty>조건에 맞는 제출물이 없습니다.</Empty> : (
        <div className="grid g2">
          {items.slice(0, 120).map((x) => (
            <article key={x.s.id} className="card stack s8">
              <div className="row between"><span className="label">{x.s.month}월 · {x.book?.title}</span><span className="tiny faint">{x.company?.name} · {x.p?.name} {x.p?.position}</span></div>
              {kind === "quotes" ? x.texts.map((t, i) => <div key={i} className="quote small">{t}</div>) : <p style={{ whiteSpace: "pre-wrap" }}>{x.texts[0]}</p>}
            </article>
          ))}
        </div>
      )}
      {items.length > 120 && <p className="small faint">상위 120건만 표시합니다. 필터로 범위를 좁히거나 '분기 보고'에서 엑셀로 전체를 내려받으세요.</p>}
    </div>
  );
}
