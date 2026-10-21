import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminHead, useAdminData } from "./common";
import NudgeModal from "./Nudge";
import { isRequired } from "../../lib/metrics";
import { FORM_LABEL, FORM_TYPES, Profile } from "../../lib/types";
import { fmtDateTime, pct } from "../../lib/format";
import { BarCell, Empty, Kpi, Loading, StatusChip } from "../../components/ui";

export default function AdminDashboard() {
  const { data, tracker, company, loading, error } = useAdminData();
  const [nudge, setNudge] = useState<Profile[] | null>(null);
  if (loading && !data) return <Loading />;
  if (!data || !tracker) return <Empty>데이터를 불러오지 못했습니다. {error}</Empty>;

  const req = data.profiles.filter(isRequired);
  const ids = req.map((p) => p.id);
  const m = tracker.currentMonth(ids);
  const cur = m ? tracker.aggregate(ids, [m]) : null;
  const all = tracker.aggregate(ids);
  const people = req.map((p) => ({ p, s: tracker.person(p.id) }));
  const risk = people.filter((x) => x.s.atRisk).sort((a, b) => b.s.overdue - a.s.overdue);
  const pending = m ? req.filter((p) => FORM_TYPES.some((f) => { const c = tracker.cell(p.id, m, f); return c.open && c.status !== "submitted" && c.status !== "late"; })) : [];
  const anySession = m ? data.sessions.find((s) => s.month === m) : null;
  const book = tracker.book(anySession ?? null);

  return (
    <div className="stack s32">
      <AdminHead company={company} title="대시보드" desc={m ? `${m}월 회차${book ? ` · 《${book.title}》` : ""}` : "회차 일정이 아직 없습니다."} />
      <div className="kpis">
        <Kpi label="대상 인원 (본부장·팀장급)" value={req.length} unit="명" sub={`대표급 ${data.profiles.filter((p) => p.is_active && p.is_participant && p.rank_level === "대표급").length}명 별도`} />
        <Kpi label={`${m ?? "-"}월 제출률`} value={cur ? pct(cur.submitted, cur.base) : 0} unit="%" sub={cur ? `${cur.submitted}/${cur.base}건 (열린 양식)` : ""} />
        <Kpi label="누적 제출률" value={pct(all.submitted, all.base)} unit="%" sub={`기한 내 ${pct(all.onTime, all.base)}%`} />
        <Kpi label="지연 제출" value={all.late} unit="건" />
        <Kpi label="수료 위험" value={risk.length} unit="명" sub="마감 지난 미제출 1건 이상" />
      </div>

      {m && (
        <section className="card">
          <div className="card-h"><h3>{m}월 양식별 제출률</h3><Link to="/admin/submissions" className="btn sm line">제출 현황 상세</Link></div>
          <div className="grid g3">
            {FORM_TYPES.map((f) => {
              const a = tracker.aggregate(ids, [m], [f]);
              const s = anySession;
              return (
                <div key={f} className="stack s8">
                  <div className="row between"><b>{FORM_LABEL[f]}</b><span className="tiny faint">{s ? `마감 ${fmtDateTime(f === "post" ? s.post_due_at : s.pre_due_at)}` : ""}</span></div>
                  <BarCell value={a.base ? a.submitted / a.base : 0} />
                  <span className="tiny faint">{a.base ? `${a.submitted}/${a.base}건 제출 · 지연 ${a.late}` : "아직 열리지 않음"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-h"><h3>그룹별 현황</h3><Link to="/admin/groups" className="btn sm line">그룹 관리</Link></div>
        {data.groups.length === 0 ? <Empty>토론 그룹이 없습니다.</Empty> : (
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>그룹</th><th className="r">대상</th><th>{m}월 제출률</th><th>누적 제출률</th><th className="r">수료 위험</th></tr></thead>
              <tbody>
                {data.groups.map((g) => {
                  const gids = req.filter((p) => tracker.group(p.id) === g.id).map((p) => p.id);
                  const a = m ? tracker.aggregate(gids, [m]) : null, b = tracker.aggregate(gids);
                  return <tr key={g.id}><td><b>{g.name}</b></td><td className="r">{gids.length}</td><td><BarCell value={a?.rate ?? 0} /></td><td><BarCell value={b.rate} /></td>
                    <td className="r">{gids.filter((id) => tracker.person(id).atRisk).length}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid g2">
        <section className="card">
          <div className="card-h"><h3>{m}월 미제출자 <span className="faint">{pending.length}명</span></h3>
            {pending.length > 0 && <button className="btn sm" onClick={() => setNudge(pending)}>독려 메일</button>}</div>
          {pending.length === 0 ? <Empty>열린 양식을 모두 제출했습니다.</Empty> : (
            <div className="stack s8">
              {pending.slice(0, 12).map((p) => (
                <div key={p.id} className="row between nowrap"><span><b>{p.name}</b> <span className="faint small">{p.position}</span></span>
                  <span className="row" style={{ gap: 4 }}>{FORM_TYPES.map((f) => { const c = tracker.cell(p.id, m!, f); return c.open ? <StatusChip key={f} status={c.status} overdue={c.overdue} /> : null; })}</span></div>
              ))}
              {pending.length > 12 && <span className="small faint">외 {pending.length - 12}명</span>}
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-h"><h3>수료 위험자 <span className="faint">{risk.length}명</span></h3>
            {risk.length > 0 && <button className="btn sm" onClick={() => setNudge(risk.map((x) => x.p))}>독려 메일</button>}</div>
          {risk.length === 0 ? <Empty>마감이 지난 미제출 건이 없습니다.</Empty> : (
            <div className="stack s8">
              {risk.slice(0, 12).map(({ p, s }) => (
                <div key={p.id} className="row between nowrap"><span><b>{p.name}</b> <span className="faint small">{p.department}</span></span><span className="chip bad">미제출 {s.overdue}건</span></div>
              ))}
            </div>
          )}
        </section>
      </div>

      {nudge && <NudgeModal people={nudge} onClose={() => setNudge(null)} subject={`[Read to Lead] ${m}월 회차 제출 안내`}
        message={`{name}님, 안녕하세요.\n${m}월 회차 양식이 아직 제출되지 않았습니다.\n12회 전 회차를 모두 제출해야 수료할 수 있으니 플랫폼에서 확인 부탁드립니다.`} />}
    </div>
  );
}
