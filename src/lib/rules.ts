import type { Book, Curriculum, FormType, Settings } from "./types";

// 첨부 자료 p.3 [SAMPLE] 연간 도서 구성 예시 — 월(1~12) 순서의 도서 id
export const SAMPLES: { key: string; name: string; desc: string; order: number[] }[] = [
  { key: "A", name: "Sample A · 균형형", desc: "인문과 경영의 균형 있는 시각으로 리더의 시야와 경영 관점을 확장", order: [11, 1, 12, 2, 10, 3, 9, 5, 8, 4, 6, 7] },
  { key: "B", name: "Sample B · 리더십 성장형", desc: "자기 이해를 바탕으로 리더십을 함양하고 조직 운영 역량까지 확장", order: [11, 4, 9, 3, 8, 2, 10, 5, 12, 6, 1, 7] },
  { key: "C", name: "Sample C · Story가 있는 구성", desc: "'나 자신 → 리더 → 조직 → 기업'으로 자연스럽게 확장되는 흐름", order: [4, 11, 3, 8, 2, 10, 6, 9, 5, 12, 1, 7] },
];

/** 연간 편성 검증: 12권 각 1회 배치 + 같은 분야 3회 연속 경고 */
export function validateCurriculum(slots: (number | null)[], books: Book[]) {
  const errors: string[] = [];
  const warnings: { month: number; msg: string }[] = [];
  const filled = slots.filter((x): x is number => x != null);
  if (filled.length < 12) errors.push(`${12 - filled.length}개 월이 비어 있습니다.`);
  const dup = filled.filter((x, i) => filled.indexOf(x) !== i);
  if (dup.length) errors.push(`중복 배치: ${[...new Set(dup)].map((id) => books.find((b) => b.id === id)?.title).join(", ")}`);
  const missing = books.filter((b) => !filled.includes(b.id));
  if (missing.length && filled.length === 12) errors.push(`빠진 도서: ${missing.map((b) => b.title).join(", ")}`);
  const cat = (id: number | null) => books.find((b) => b.id === id)?.category;
  for (let m = 2; m < 12; m++) {
    const c = cat(slots[m]);
    if (c && c === cat(slots[m - 1]) && c === cat(slots[m - 2])) {
      warnings.push({ month: m + 1, msg: `${m - 1}~${m + 1}월 ${c === "경영" ? "경제·경영" : c} 분야 3회 연속 (교차 배치 권장)` });
    }
  }
  return { errors, warnings };
}

/** 회차의 도서: 그룹별 편성 → 없으면 계열사 공통 편성 */
export function bookIdFor(curricula: Curriculum[], companyId: string, groupId: string | null, month: number) {
  return (groupId ? curricula.find((c) => c.group_id === groupId && c.month === month) : undefined)?.book_id
    ?? curricula.find((c) => c.company_id === companyId && !c.group_id && c.month === month)?.book_id
    ?? null;
}

// ---------- 양식 정의 (첨부 p.1 '과제 제출' 표) ----------
export interface FieldDef { key: string; label: string; help: string; kind: "summary" | "text" | "quotes"; }
export const FORM_FIELDS: Record<FormType, FieldDef[]> = {
  pre: [
    { key: "summary", label: "핵심 요약", help: "책 전체의 핵심을 300자 수준으로 요약해 주세요.", kind: "summary" },
    { key: "quotes", label: "핵심 인용구절 3개", help: "가장 인상 깊었던 구절 3개와 쪽수(선택)를 적어 주세요.", kind: "quotes" },
  ],
  presentation: [
    { key: "feeling", label: "느낀 점", help: "책을 읽으며 가장 크게 느낀 점", kind: "text" },
    { key: "implication", label: "시사점", help: "리더·조직 관점에서 얻은 시사점", kind: "text" },
    { key: "application", label: "현업 적용점", help: "우리 팀·조직에 적용할 구체적인 행동", kind: "text" },
    { key: "perspective", label: "공유하고 싶은 관점", help: "토론에서 함께 이야기하고 싶은 질문·관점", kind: "text" },
  ],
  post: [
    { key: "topic", label: "토론 주제", help: "이번 회차에서 다룬 핵심 안건·토론 주제", kind: "text" },
    { key: "insight", label: "인사이트", help: "토론을 통해 새롭게 얻은 인사이트", kind: "text" },
    { key: "expectation", label: "기대사항", help: "개인·조직 차원의 기대사항과 다음 실천", kind: "text" },
  ],
};

export const emptyContent = (f: FormType): Record<string, any> =>
  f === "pre" ? { summary: "", quotes: [{ text: "", page: "" }, { text: "", page: "" }, { text: "", page: "" }] }
    : Object.fromEntries(FORM_FIELDS[f].map((x) => [x.key, ""]));

/** 제출 전 검증 — 오류 메시지 배열(비어 있으면 통과) */
export function validateContent(f: FormType, c: Record<string, any>, s: Pick<Settings, "summary_min" | "summary_max" | "field_min">): Record<string, string> {
  const errs: Record<string, string> = {};
  const len = (v: string) => [...(v ?? "").replace(/\s+/g, " ").trim()].length;
  if (f === "pre") {
    const n = len(c.summary);
    if (n < s.summary_min || n > s.summary_max) errs.summary = `${s.summary_min}~${s.summary_max}자로 작성해 주세요. (현재 ${n}자)`;
    const q = (c.quotes ?? []) as { text: string }[];
    if (q.length < 3 || q.some((x) => !x.text?.trim())) errs.quotes = "인용구절 3개를 모두 입력해 주세요.";
  } else {
    for (const fd of FORM_FIELDS[f]) {
      const n = len(c[fd.key]);
      if (n < s.field_min) errs[fd.key] = `${s.field_min}자 이상 작성해 주세요. (현재 ${n}자)`;
    }
  }
  return errs;
}

/** 토론일 기준 기본 일정 계산 (KST 23:59 마감) */
export function defaultDates(meetAtIso: string, s: Pick<Settings, "open_offset_days" | "pre_due_offset_days" | "post_due_offset_days">) {
  const day = (iso: string, offset: number, hhmm: string) => {
    const kst = new Date(new Date(iso).getTime() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
    return new Date(`${kst}T${hhmm}:00+09:00`).toISOString();
  };
  return {
    open_at: day(meetAtIso, -s.open_offset_days, "09:00"),
    pre_due_at: day(meetAtIso, -s.pre_due_offset_days, "23:59"),
    post_due_at: day(meetAtIso, s.post_due_offset_days, "23:59"),
  };
}

/** n번째 요일 (예: 매월 셋째 수요일) — KST 기준 ISO */
export function nthWeekday(year: number, month: number, nth: number, weekday: number, hhmm: string) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  let date = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (date > last) date -= 7; // '마지막 주'
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}T${hhmm}:00+09:00`).toISOString();
}
