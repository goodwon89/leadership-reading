import { useEffect, useState } from "react";
import { AdminHead, useAdminData } from "./common";
import { db, errMsg } from "../../lib/supabase";
import { SAMPLES, validateCurriculum } from "../../lib/rules";
import { catLabel } from "../../lib/types";
import { Confirm, Empty, Icon, Loading, useToast } from "../../components/ui";

export default function CurriculumPage() {
  const { data, company, companyId, loading, reload } = useAdminData();
  const toast = useToast();
  const [scope, setScope] = useState<string>(""); // "" = 계열사 공통, else group id
  const [slots, setSlots] = useState<(number | null)[]>(Array(12).fill(null));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clearGroup, setClearGroup] = useState(false);

  const perGroup = !!company?.per_group_curriculum;
  const groupRows = data?.curricula.filter((c) => c.group_id === (scope || null)) ?? [];
  const companyRows = data?.curricula.filter((c) => !c.group_id) ?? [];
  const usingCommon = !!scope && groupRows.length === 0;

  useEffect(() => {
    if (!data) return;
    const src = scope && groupRows.length ? groupRows : companyRows;
    setSlots(Array.from({ length: 12 }, (_, i) => src.find((c) => c.month === i + 1)?.book_id ?? null));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scope]);

  if (loading && !data) return <Loading />;
  if (!data || !company) return <Empty>데이터를 불러오지 못했습니다.</Empty>;

  const now = new Date();
  // 이미 열린 회차의 월은 잠금 (공통 편성은 공통을 따르는 그룹 기준)
  const scopeGroups = scope ? [scope] : data.groups.filter((g) => !data.curricula.some((c) => c.group_id === g.id)).map((g) => g.id);
  const lockedMonth = (m: number) => data.sessions.some((s) => s.month === m && scopeGroups.includes(s.group_id) && new Date(s.open_at) <= now);
  const { errors, warnings } = validateCurriculum(slots, data.books);
  const warnMonths = new Set(warnings.flatMap((w) => [w.month - 2, w.month - 1, w.month]));
  const book = (id: number | null) => data.books.find((b) => b.id === id);
  const set = (next: (number | null)[]) => { setSlots(next); setDirty(true); };
  const swap = (i: number, j: number) => { if (j < 0 || j > 11 || lockedMonth(i + 1) || lockedMonth(j + 1)) return; const n = [...slots]; [n[i], n[j]] = [n[j], n[i]]; set(n); };
  const loadSample = (order: number[]) => set(slots.map((cur, i) => (lockedMonth(i + 1) ? cur : order[i])));

  const save = async () => {
    if (errors.length) return toast(errors[0], true);
    setBusy(true);
    try {
      const months = slots.map((_, i) => i + 1).filter((m) => !lockedMonth(m));
      let del = db.from("curricula").delete().eq("company_id", companyId).in("month", months);
      del = scope ? del.eq("group_id", scope) : del.is("group_id", null);
      const r1 = await del; if (r1.error) throw r1.error;
      const r2 = await db.from("curricula").insert(months.map((m) => ({ company_id: companyId, group_id: scope || null, month: m, book_id: slots[m - 1] })));
      if (r2.error) throw r2.error;
      toast("연간 도서 편성을 저장했습니다."); reload();
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  const togglePerGroup = async () => {
    const { error } = await db.from("companies").update({ per_group_curriculum: !perGroup }).eq("id", companyId);
    if (error) return toast(errMsg(error), true);
    if (perGroup) setScope("");
    reload();
  };

  return (
    <div className="stack s24">
      <AdminHead company={company} title="연간 도서 편성" desc="12권의 순서를 정합니다. 인문·경영 교차 배치를 권장하며, 이미 열린 회차의 월은 바꿀 수 없습니다."
        right={<button className="btn" disabled={busy || !dirty || errors.length > 0} onClick={save}>{busy ? "저장 중…" : "저장"}</button>} />

      <div className="row">
        <label className="check"><input type="checkbox" checked={perGroup} onChange={togglePerGroup} />그룹마다 다른 순서 허용</label>
        {perGroup && (
          <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ width: "auto" }}>
            <option value="">계열사 공통 편성</option>
            {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name} 전용 편성</option>)}
          </select>
        )}
        {scope && !usingCommon && <button className="btn xs ghost" onClick={() => setClearGroup(true)}>공통 편성 따르기로 되돌리기</button>}
      </div>
      {usingCommon && <div className="banner info">이 그룹은 현재 계열사 공통 편성을 따릅니다. 수정해서 저장하면 그룹 전용 편성이 만들어집니다.</div>}

      <div className="grid g3">
        {SAMPLES.map((s) => (
          <button key={s.key} className="card tight flat stack s8" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => loadSample(s.order)}>
            <b>{s.name}</b><span className="tiny faint">{s.desc}</span><span className="small" style={{ color: "var(--link)" }}>불러오기</span>
          </button>
        ))}
      </div>

      {errors.length > 0 && <div className="banner bad">{errors.join(" · ")}</div>}
      {warnings.length > 0 && <div className="banner warn">{warnings.map((w) => w.msg).join(" · ")} — 저장은 가능합니다.</div>}

      <div className="stack s8">
        {slots.map((id, i) => {
          const m = i + 1, b = book(id), lock = lockedMonth(m);
          return (
            <div key={m} className={`slot${lock ? " locked" : ""}${warnMonths.has(m) ? " warn" : ""}`}>
              <b>{m}월</b>
              <span className={`chip slot-cat ${b?.category === "인문" ? "acc" : ""}`}>{b ? catLabel(b.category) : "-"}</span>
              <select value={id ?? ""} disabled={lock} onChange={(e) => { const n = [...slots]; n[i] = e.target.value ? Number(e.target.value) : null; set(n); }} aria-label={`${m}월 도서`}>
                <option value="">선택</option>
                {data.books.map((bk) => <option key={bk.id} value={bk.id}>[{catLabel(bk.category)}] {bk.title}{slots.includes(bk.id) && bk.id !== id ? " · 배치됨" : ""}</option>)}
              </select>
              <div className="row nowrap" style={{ gap: 0 }}>
                {lock ? <span className="chip line">진행됨</span> : <>
                  <button className="icon-btn" aria-label="위로" onClick={() => swap(i, i - 1)}><Icon.up /></button>
                  <button className="icon-btn" aria-label="아래로" onClick={() => swap(i, i + 1)}><Icon.down /></button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="tiny faint">경제·경영 7권, 인문 5권이라 완전한 교차 배치는 불가능합니다(첨부 Sample A·B·C 모두 11~12월 경영 연속). 3회 연속은 경고만 표시합니다.</p>

      {clearGroup && <Confirm title="공통 편성 따르기" onClose={() => setClearGroup(false)} onOk={async () => {
        const { error } = await db.from("curricula").delete().eq("group_id", scope);
        if (error) return toast(errMsg(error), true);
        setClearGroup(false); reload(); toast("이 그룹은 이제 계열사 공통 편성을 따릅니다.");
      }} body={<p>그룹 전용 편성을 삭제하고 계열사 공통 편성을 따르게 합니다.</p>} />}
    </div>
  );
}
