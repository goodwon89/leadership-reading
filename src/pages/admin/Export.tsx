import { useState } from "react";
import { AdminHead, useAdminData } from "./common";
import { downloadXlsx } from "../../lib/excel";
import { contentSheet, fetchContents, statusSheet } from "../../lib/reports";
import { errMsg } from "../../lib/supabase";
import { FORM_TYPES } from "../../lib/types";
import { kstDay } from "../../lib/format";
import { Empty, Icon, Loading, useToast } from "../../components/ui";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ExportPage() {
  const { data, tracker, company, companyId, loading } = useAdminData();
  const toast = useToast();
  const [month, setMonth] = useState(1);
  const [quarter, setQuarter] = useState(1);
  const [busy, setBusy] = useState("");
  if (loading && !data) return <Loading />;
  if (!data || !tracker || !company) return <Empty>데이터를 불러오지 못했습니다.</Empty>;
  const today = kstDay(new Date()).replace(/-/g, "");

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast(errMsg(e), true); } finally { setBusy(""); } };
  const exportMonth = () => run("m", async () => {
    const subs = await fetchContents(companyId, [month]);
    await downloadXlsx(`${company.name}_${month}월_제출물_${today}.xlsx`, [statusSheet(tracker, [month], `${month}월 현황`), ...FORM_TYPES.map((f) => contentSheet(tracker, subs, f, [month]))]);
  });
  const exportQuarter = () => run("q", async () => {
    const ms = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3];
    const subs = await fetchContents(companyId, ms);
    await downloadXlsx(`${company.name}_${data.settings.year}_${quarter}분기_보고_${today}.xlsx`, [statusSheet(tracker, ms, `${quarter}분기 현황`), ...FORM_TYPES.map((f) => contentSheet(tracker, subs, f, ms))]);
  });
  const exportAll = () => run("a", async () => { await downloadXlsx(`${company.name}_연간_제출현황_${today}.xlsx`, [statusSheet(tracker, MONTHS)]); });

  return (
    <div className="stack s24">
      <AdminHead company={company} title="내보내기" desc="엑셀로 내려받아 분기별 인재경영실 제출 자료로 활용합니다. 총괄 관리자는 플랫폼에서 같은 데이터를 실시간으로 볼 수 있습니다." />
      <div className="grid g3">
        <section className="card stack">
          <h3>회차(월)별 제출물</h3>
          <p className="small muted">해당 월 제출 현황 + 사전학습·발표자료·과제 전문</p>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}</select>
          <button className="btn" disabled={!!busy} onClick={exportMonth}><Icon.download size={16} />{busy === "m" ? "만드는 중…" : "엑셀 내려받기"}</button>
        </section>
        <section className="card stack">
          <h3>분기 보고</h3>
          <p className="small muted">3개월 현황 + 제출물 전문 (분기별 인재경영실 제출용)</p>
          <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}분기 ({q * 3 - 2}~{q * 3}월)</option>)}</select>
          <button className="btn" disabled={!!busy} onClick={exportQuarter}><Icon.download size={16} />{busy === "q" ? "만드는 중…" : "엑셀 내려받기"}</button>
        </section>
        <section className="card stack">
          <h3>연간 제출 현황</h3>
          <p className="small muted">대상자 × 12개월 × 3양식 상태, 누적 제출·지연·수료 구분</p>
          <div className="spacer" />
          <button className="btn" disabled={!!busy} onClick={exportAll}><Icon.download size={16} />{busy === "a" ? "만드는 중…" : "엑셀 내려받기"}</button>
        </section>
      </div>
    </div>
  );
}
