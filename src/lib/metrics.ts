// 제출 현황·수료 판정·대시보드 지표 계산 (스펙 4장·7장 산식)
import type { Book, Company, Curriculum, FormType, Group, Member, Override, Profile, Session, Settings, Submission } from "./types";
import { FORM_TYPES } from "./types";
import { bookIdFor } from "./rules";

export interface Dataset {
  companies: Company[]; profiles: Profile[]; groups: Group[]; members: Member[]; sessions: Session[];
  curricula: Curriculum[]; submissions: Submission[]; overrides: Override[]; books: Book[]; settings: Settings;
}

export type CellStatus = "none" | "draft" | "submitted" | "late";
export interface Cell {
  status: CellStatus; session: Session | null; due: string | null; open: boolean;
  /** 마감이 지났는데 미제출 */ overdue: boolean; extended: boolean; sub: Submission | null;
}

export const isRequired = (p: Profile) => p.is_active && p.is_participant && p.rank_level !== "대표급";
export const TOTAL_FORMS = 36;

export class Tracker {
  private groupOf = new Map<string, string>();
  private sess = new Map<string, Session>();
  private subs = new Map<string, Submission>();
  private ovr = new Map<string, Override>();
  constructor(public ds: Dataset, public now = new Date()) {
    ds.members.forEach((m) => this.groupOf.set(m.profile_id, m.group_id));
    ds.sessions.forEach((s) => this.sess.set(`${s.group_id}:${s.month}`, s));
    ds.submissions.forEach((s) => {
      const key = `${s.profile_id}:${s.month}:${s.form_type}`;
      const prev = this.subs.get(key);
      if (!prev || (s.status === "submitted" && prev.status !== "submitted")) this.subs.set(key, s);
    });
    ds.overrides.forEach((o) => this.ovr.set(`${o.session_id}:${o.profile_id}:${o.form_type}`, o));
  }
  group(pid: string) { return this.groupOf.get(pid) ?? null; }
  session(pid: string, month: number) { const g = this.groupOf.get(pid); return g ? this.sess.get(`${g}:${month}`) ?? null : null; }
  groupSession(gid: string, month: number) { return this.sess.get(`${gid}:${month}`) ?? null; }
  sub(pid: string, month: number, f: FormType) { return this.subs.get(`${pid}:${month}:${f}`) ?? null; }
  override(sid: string, pid: string, f: FormType) { return this.ovr.get(`${sid}:${pid}:${f}`) ?? null; }
  due(s: Session, pid: string, f: FormType) {
    return this.override(s.id, pid, f)?.new_due_at ?? (f === "post" ? s.post_due_at : s.pre_due_at);
  }
  book(s: Session | null): Book | null {
    if (!s) return null;
    const id = bookIdFor(this.ds.curricula, s.company_id, s.group_id, s.month);
    return this.ds.books.find((b) => b.id === id) ?? null;
  }
  cell(pid: string, month: number, f: FormType): Cell {
    const session = this.session(pid, month);
    const sub = this.sub(pid, month, f);
    const status: CellStatus = !sub ? "none" : sub.status === "draft" ? "draft" : sub.is_late ? "late" : "submitted";
    if (!session) return { status, session: null, due: null, open: false, overdue: false, extended: false, sub };
    const due = this.due(session, pid, f);
    const open = new Date(session.open_at) <= this.now;
    const done = status === "submitted" || status === "late";
    return { status, session, due, open, overdue: !done && new Date(due) < this.now, extended: !!this.override(session.id, pid, f), sub };
  }
  person(pid: string) {
    let submitted = 0, late = 0, overdue = 0, opened = 0, draft = 0;
    for (let m = 1; m <= 12; m++) for (const f of FORM_TYPES) {
      const c = this.cell(pid, m, f);
      if (c.status === "submitted" || c.status === "late") submitted++;
      if (c.status === "late") late++;
      if (c.status === "draft") draft++;
      if (c.overdue) overdue++;
      if (c.open) opened++;
    }
    return { submitted, late, overdue, opened, draft, completed: submitted >= TOTAL_FORMS, atRisk: overdue > 0 };
  }
  /** 열린 회차 기준 집계 (months 지정 시 해당 월만) */
  aggregate(pids: string[], months?: number[], forms: FormType[] = FORM_TYPES) {
    let base = 0, submitted = 0, onTime = 0, late = 0, overdue = 0;
    const ms = months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    for (const pid of pids) for (const m of ms) for (const f of forms) {
      const c = this.cell(pid, m, f);
      if (!c.open) continue;
      base++;
      if (c.status === "submitted") { submitted++; onTime++; }
      if (c.status === "late") { submitted++; late++; }
      if (c.overdue) overdue++;
    }
    return { base, submitted, onTime, late, overdue, rate: base ? submitted / base : 0, onTimeRate: base ? onTime / base : 0 };
  }
  /** 현재 진행 회차(월) — 열린 회차 중 과제 마감이 가장 늦게 남은 것, 없으면 다음 예정 */
  currentMonth(pids: string[]): number | null {
    const months = new Set<number>();
    pids.forEach((pid) => { const g = this.groupOf.get(pid); if (g) this.ds.sessions.filter((s) => s.group_id === g).forEach((s) => months.add(s.month)); });
    const list = [...months].sort((a, b) => a - b);
    const sample = (m: number) => this.ds.sessions.find((s) => s.month === m && pids.some((p) => this.groupOf.get(p) === s.group_id));
    const active = list.filter((m) => { const s = sample(m); return s && new Date(s.open_at) <= this.now; });
    const live = active.filter((m) => new Date(sample(m)!.post_due_at) >= this.now);
    if (live.length) return live[0];
    if (active.length) return active[active.length - 1];
    return list[0] ?? null;
  }
}

export const requiredIds = (ps: Profile[]) => ps.filter(isRequired).map((p) => p.id);
