// 엑셀 내보내기·분기 보고 공통 행 생성
import { db, fetchAll } from "./supabase";
import { isRequired, Tracker } from "./metrics";
import { FORM_LABEL, FORM_TYPES, FormType, Submission } from "./types";
import { FORM_FIELDS } from "./rules";
import { fmtFull } from "./format";
import type { SheetDef } from "./excel";

const ST = { none: "", draft: "임시저장", submitted: "제출", late: "지연제출" } as const;

export async function fetchContents(companyId: string | null, months: number[]) {
  return fetchAll<Submission>(() => {
    let q = db.from("submissions").select("*").in("month", months);
    if (companyId) q = q.eq("company_id", companyId);
    return q;
  });
}

const companyName = (t: Tracker, cid: string) => t.ds.companies.find((c) => c.id === cid)?.name ?? "";
const groupName = (t: Tracker, pid: string) => t.ds.groups.find((g) => g.id === t.group(pid))?.name ?? "미배정";

/** 사람 × 월 제출 현황 */
export function statusSheet(t: Tracker, months: number[], name = "제출 현황"): SheetDef {
  const people = t.ds.profiles.filter((p) => p.is_active && p.is_participant);
  return {
    name,
    rows: people.map((p) => {
      const s = t.person(p.id);
      const row: Record<string, any> = { 계열사: companyName(t, p.company_id), 그룹: groupName(t, p.id), 사번: p.emp_no, 성명: p.name, 직급: p.rank_level, 직책: p.position ?? "" };
      for (const m of months) for (const f of FORM_TYPES) {
        const c = t.cell(p.id, m, f);
        row[`${m}월 ${FORM_LABEL[f]}`] = !c.session ? "-" : c.overdue && isRequired(p) ? (c.status === "draft" ? "미제출(임시저장)" : "미제출") : ST[c.status] || (c.open ? "미작성" : "예정");
      }
      row["누적 제출(36)"] = s.submitted; row["지연"] = s.late; row["미제출(마감 경과)"] = isRequired(p) ? s.overdue : "";
      row["구분"] = isRequired(p) ? (s.completed ? "수료" : s.atRisk ? "수료 위험" : "정상 진행") : "과제 대상 아님";
      return row;
    }),
  };
}

/** 양식별 제출물 전문 */
export function contentSheet(t: Tracker, subs: Submission[], form: FormType, months: number[]): SheetDef {
  const rows = subs.filter((s) => s.form_type === form && s.status === "submitted" && months.includes(s.month))
    .sort((a, b) => a.month - b.month || a.company_id.localeCompare(b.company_id))
    .map((s) => {
      const p = t.ds.profiles.find((x) => x.id === s.profile_id);
      const book = t.book(t.ds.sessions.find((x) => x.id === s.session_id) ?? null);
      const row: Record<string, any> = { 월: s.month, 도서: book?.title ?? "", 계열사: companyName(t, s.company_id), 그룹: p ? groupName(t, p.id) : "", 사번: p?.emp_no ?? "", 성명: p?.name ?? "", 제출일시: fmtFull(s.submitted_at), 지연: s.is_late ? "Y" : "" };
      for (const fd of FORM_FIELDS[form]) {
        if (fd.kind === "quotes") ((s.content?.quotes ?? []) as { text: string; page?: string }[]).forEach((q, i) => (row[`인용구절 ${i + 1}`] = q.text + (q.page ? ` (p.${q.page})` : "")));
        else row[fd.label] = s.content?.[fd.key] ?? "";
      }
      return row;
    });
  return { name: `${FORM_LABEL[form]} 전문`, rows };
}

/** 계열사별 요약 (분기 보고 1면) */
export function companySummary(t: Tracker, months: number[]) {
  return t.ds.companies.map((c) => {
    const req = t.ds.profiles.filter((p) => p.company_id === c.id && isRequired(p));
    const ids = req.map((p) => p.id);
    const a = t.aggregate(ids, months);
    const risk = ids.filter((id) => months.some((m) => FORM_TYPES.some((f) => t.cell(id, m, f).overdue))).length;
    return { company: c, people: req.length, ...a, risk };
  }).filter((x) => x.people > 0);
}
