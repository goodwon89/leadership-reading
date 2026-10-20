import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHqData } from "./common";
import { useAuth } from "../../state/auth";
import { isRequired, Tracker } from "../../lib/metrics";
import { pct } from "../../lib/format";
import { BarCell, Empty, Kpi, Loading, PageHead } from "../../components/ui";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function HqDashboard() {
  const { data, tracker, loading, error } = useHqData();
  const { setScopeCompanyId } = useAuth();
  const nav = useNavigate();
  const [view, setView] = useState<"chart" | "table">("chart");
  if (loading && !data) return <Loading />;
  if (!data || !tracker) return <Empty>데이터를 불러오지 못했습니다. {error}</Empty>;

  const req = data.profiles.filter(isRequired);
  const ids = req.map((p) => p.id);
  const all = tracker.aggregate(ids);
  const risk = ids.filter((id) => tracker.person(id).atRisk).length;
  const m = tracker.currentMonth(ids);
  const monthly = MONTHS.map((mm) => ({ m: mm, ...tracker.aggregate(ids, [mm]), live: data.sessions.some((s) => s.month === mm && new Date(s.post_due_at) > tracker.now) })).filter((x) => x.base > 0);
  const companies = data.companies.map((c) => {
    const cids = req.filter((p) => p.company_id === c.id).map((p) => p.id);
    const a = tracker.aggregate(cids), cur = m ? tracker.aggregate(cids, [m]) : null;
    return { c, n: cids.length, a, cur, risk: cids.filter((id) => tracker.person(id).atRisk).length };
  }).filter((x) => x.n > 0).sort((x, y) => y.a.rate - x.a.rate);

  return (
    <div className="stack s32">
      <PageHead label="총괄 관리자" title="그룹 대시보드" desc={`9개 계열사 실시간 현황 · 열린 양식 기준 · 현재 ${m ?? "-"}월 회차`} />
      <div className="kpis">
        <Kpi label="과제 대상 인원" value={req.length} unit="명" sub={`대표급 ${data.profiles.filter((p) => p.is_active && p.is_participant && p.rank_level === "대표급").length}명 별도`} />
        <Kpi label="누적 제출률" value={pct(all.submitted, all.base)} unit="%" sub={`${all.submitted.toLocaleString()} / ${all.base.toLocaleString()}건`} />
        <Kpi label="기한 내 제출률" value={pct(all.onTime, all.base)} unit="%" />
        <Kpi label="지연 제출" value={all.late} unit="건" />
        <Kpi label="수료 예상" value={req.length - risk} unit="명" sub="마감 지난 양식 모두 제출" />
        <Kpi label="수료 위험" value={risk} unit="명" sub="마감 지난 미제출 1건 이상" />
      </div>

      <section className="card">
        <div className="card-h"><div><h3>계열사 비교</h3><p className="small muted">누적 제출률 높은 순 · 행을 누르면 해당 계열사 관리 화면으로 이동</p></div></div>
        <div className="tbl-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>계열사</th><th className="r">대상</th><th>{m}월 제출률</th><th>누적 제출률</th><th>기한 내</th><th className="r">지연</th><th className="r">수료 위험</th></tr></thead>
            <tbody>
              {companies.map(({ c, n, a, cur, risk: r }) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => { setScopeCompanyId(c.id); nav("/admin"); }}>
                  <td><b>{c.name}</b></td><td className="r">{n}</td>
                  <td>{cur && cur.base ? <BarCell value={cur.rate} /> : <span className="faint small">-</span>}</td>
                  <td><BarCell value={a.rate} /></td>
                  <td className="num small">{pct(a.onTime, a.base)}%</td>
                  <td className="r">{a.late}</td>
                  <td className="r">{r > 0 ? <span className="chip bad">{r}</span> : <span className="faint">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><div><h3>월별 제출률 추이</h3><p className="small muted">그룹 전체 · 해당 월 열린 양식 대비 제출(지연 포함) · 점선은 마감 전 진행 중인 회차</p></div>
          <div className="tabs" style={{ border: 0 }}><button aria-selected={view === "chart"} onClick={() => setView("chart")}>차트</button><button aria-selected={view === "table"} onClick={() => setView("table")}>표</button></div></div>
        {monthly.length === 0 ? <Empty>아직 열린 회차가 없습니다.</Empty> : view === "chart" ? <TrendChart rows={monthly} /> : (
          <div className="tbl-wrap"><table><thead><tr><th>월</th><th className="r">대상 양식</th><th className="r">제출</th><th className="r">지연</th><th className="r">제출률</th></tr></thead>
            <tbody>{monthly.map((x) => <tr key={x.m}><td>{x.m}월</td><td className="r">{x.base}</td><td className="r">{x.submitted}</td><td className="r">{x.late}</td><td className="r"><b>{pct(x.submitted, x.base)}%</b></td></tr>)}</tbody></table></div>
        )}
      </section>

      <section className="card">
        <div className="card-h"><div><h3>계열사 × 월 제출률</h3><p className="small muted">색이 진할수록 제출률이 높습니다. 빈 칸은 아직 열리지 않은 회차입니다.</p></div></div>
        <Heatmap tracker={tracker} companies={companies.map((x) => x.c)} />
      </section>
    </div>
  );
}

function TrendChart({ rows }: { rows: { m: number; rate: number; submitted: number; base: number; late: number; live: boolean }[] }) {
  const W = 760, H = 240, L = 44, R = 24, T = 24, B = 32;
  const x = (m: number) => L + ((m - 1) / 11) * (W - L - R);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const done = rows.filter((r) => !r.live), live = rows.filter((r) => r.live);
  const path = done.map((r, i) => `${i ? "L" : "M"}${x(r.m)},${y(r.rate)}`).join("");
  const lastDone = done[done.length - 1];
  const livePath = live.length ? [...(lastDone ? [lastDone] : []), ...live].map((r, i) => `${i ? "L" : "M"}${x(r.m)},${y(r.rate)}`).join("") : "";
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="월별 제출률 추이">
      {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line className="grid-l" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{v * 100}%</text></g>)}
      {MONTHS.map((m) => <text key={m} x={x(m)} y={H - 10} textAnchor="middle">{m}월</text>)}
      {path && <path className="series" d={path} strokeLinejoin="round" strokeLinecap="round" />}
      {livePath && <path className="series" d={livePath} strokeDasharray="4 5" style={{ opacity: 0.6 }} />}
      {rows.map((r) => (
        <g key={r.m}>
          <circle className="pt" cx={x(r.m)} cy={y(r.rate)} r={4.5} style={r.live ? { strokeDasharray: "2 2" } : undefined}><title>{`${r.m}월 · ${pct(r.submitted, r.base)}% (${r.submitted}/${r.base}건, 지연 ${r.late})`}</title></circle>
          <rect x={x(r.m) - 18} y={T} width={36} height={H - T - B} fill="transparent"><title>{`${r.m}월 · ${pct(r.submitted, r.base)}% (${r.submitted}/${r.base}건, 지연 ${r.late})`}</title></rect>
        </g>
      ))}
      {lastDone && <text className="lbl" x={x(lastDone.m)} y={y(lastDone.rate) - 12} textAnchor="middle">{pct(lastDone.submitted, lastDone.base)}%</text>}
      {live.map((r) => <text key={r.m} x={x(r.m) + 10} y={y(r.rate) + 4}>{`${r.m}월 진행 중 ${pct(r.submitted, r.base)}%`}</text>)}
    </svg>
  );
}

function Heatmap({ tracker, companies }: { tracker: Tracker; companies: { id: string; name: string }[] }) {
  return (
    <div className="tbl-wrap" style={{ border: 0 }}>
      <table className="heat">
        <thead><tr><th style={{ padding: "8px 10px" }}>계열사</th>{MONTHS.map((m) => <th key={m} className="c" style={{ padding: "8px 4px" }}>{m}월</th>)}</tr></thead>
        <tbody>
          {companies.map((c) => {
            const ids = tracker.ds.profiles.filter((p) => p.company_id === c.id && isRequired(p)).map((p) => p.id);
            return (
              <tr key={c.id}><td style={{ padding: "6px 10px", border: 0 }}><b className="small">{c.name}</b></td>
                {MONTHS.map((m) => {
                  const a = tracker.aggregate(ids, [m]);
                  if (!a.base) return <td key={m}><span style={{ background: "var(--subtle)", opacity: 0.4 }} /></td>;
                  const v = a.rate;
                  return <td key={m} title={`${c.name} ${m}월 ${pct(a.submitted, a.base)}% (${a.submitted}/${a.base})`}>
                    <span style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(6 + v * 50)}%, var(--surface))`, color: "var(--ink)" }}>{Math.round(v * 100)}</span></td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
