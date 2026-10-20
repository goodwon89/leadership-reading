import { useState } from "react";
import { useHqData } from "./common";
import { companySummary, contentSheet, fetchContents, statusSheet } from "../../lib/reports";
import { downloadXlsx } from "../../lib/excel";
import { isRequired } from "../../lib/metrics";
import { FORM_LABEL, FORM_TYPES } from "../../lib/types";
import { kstDay, pct } from "../../lib/format";
import { errMsg } from "../../lib/supabase";
import { SINGLE } from "../../components/Layout";
import { BarCell, Empty, Icon, Kpi, Loading, PageHead, useToast } from "../../components/ui";

export default function Report() {
  const { data, tracker, loading } = useHqData();
  const toast = useToast();
  const [q, setQ] = useState(1);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Loading />;
  if (!data || !tracker) return <Empty>데이터를 불러오지 못했습니다.</Empty>;

  const months = [q * 3 - 2, q * 3 - 1, q * 3];
  const rows = companySummary(tracker, months);
  const ids = data.profiles.filter(isRequired).map((p) => p.id);
  const all = tracker.aggregate(ids, months);
  const risks = data.profiles.filter(isRequired).map((p) => ({ p, miss: months.flatMap((m) => FORM_TYPES.filter((f) => tracker.cell(p.id, m, f).overdue).map((f) => `${m}월 ${FORM_LABEL[f]}`)) })).filter((x) => x.miss.length);

  const download = async () => {
    setBusy(true);
    try {
      const subs = await fetchContents(null, months);
      await downloadXlsx(`리더십2년차_${data.settings.year}_${q}분기_그룹보고_${kstDay(new Date()).replace(/-/g, "")}.xlsx`, [
        { name: "계열사 요약", rows: rows.map((r) => ({ 계열사: r.company.name, "대상(명)": r.people, "대상 양식": r.base, 제출: r.submitted, "제출률(%)": pct(r.submitted, r.base), "기한 내 제출률(%)": pct(r.onTime, r.base), 지연: r.late, "미제출(마감 경과)": r.overdue, "수료 위험(명)": r.risk })) },
        { name: "미제출자", rows: risks.map((x) => ({ 계열사: data.companies.find((c) => c.id === x.p.company_id)?.name, 사번: x.p.emp_no, 성명: x.p.name, 직급: x.p.rank_level, 미제출: x.miss.join(", ") })) },
        statusSheet(tracker, months, `${q}분기 개인별 현황`),
        ...FORM_TYPES.map((f) => contentSheet(tracker, subs, f, months)),
      ]);
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };

  return (
    <div className="stack s24">
      <PageHead label="총괄 관리자" title="분기 보고" desc="계열사별 제출·지연·수료 위험 요약과 제출물 전문을 엑셀로 만듭니다. 오너 보고 자료의 원천 데이터입니다."
        right={<>
          <select value={q} onChange={(e) => setQ(Number(e.target.value))} style={{ width: "auto" }}>{[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}분기 ({x * 3 - 2}~{x * 3}월)</option>)}</select>
          <button className="btn" disabled={busy} onClick={download}><Icon.download size={16} />{busy ? "만드는 중…" : "엑셀"}</button>
          {!SINGLE && <button className="btn line no-print" onClick={() => window.print()}>인쇄</button>}
        </>} />
      <div className="kpis">
        <Kpi label="대상 양식" value={all.base.toLocaleString()} unit="건" sub="열린 회차 기준" />
        <Kpi label="제출률" value={pct(all.submitted, all.base)} unit="%" />
        <Kpi label="기한 내 제출률" value={pct(all.onTime, all.base)} unit="%" />
        <Kpi label="지연 제출" value={all.late} unit="건" />
        <Kpi label="미제출자" value={risks.length} unit="명" />
      </div>
      {all.base === 0 ? <Empty>{q}분기에 열린 회차가 아직 없습니다.</Empty> : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>계열사</th><th className="r">대상</th><th>제출률</th><th className="r">기한 내</th><th className="r">지연</th><th className="r">미제출 건</th><th className="r">수료 위험</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.company.id}><td><b>{r.company.name}</b></td><td className="r">{r.people}</td><td><BarCell value={r.rate} /></td><td className="r num">{pct(r.onTime, r.base)}%</td><td className="r">{r.late}</td><td className="r">{r.overdue}</td><td className="r">{r.risk}</td></tr>)}</tbody>
            </table>
          </div>
          <section className="card">
            <h3 style={{ marginBottom: 12 }}>미제출자 ({risks.length}명)</h3>
            {risks.length === 0 ? <p className="small muted">마감이 지난 미제출 건이 없습니다.</p> : (
              <div className="tbl-wrap" style={{ border: 0 }}>
                <table><thead><tr><th>계열사</th><th>성명</th><th>직급</th><th>미제출 항목</th></tr></thead>
                  <tbody>{risks.map((x) => <tr key={x.p.id}><td>{data.companies.find((c) => c.id === x.p.company_id)?.name}</td><td><b>{x.p.name}</b></td><td>{x.p.rank_level}</td><td className="small">{x.miss.join(", ")}</td></tr>)}</tbody></table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
