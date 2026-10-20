// 데모 모드용 가짜 Supabase 클라이언트.
// 앱이 실제로 쓰는 query builder 일부(select/insert/update/upsert/delete + eq/in/... + order/range/single)를
// 브라우저 메모리(+localStorage)로 흉내냅니다. 실제 DB 트리거(마감·잠금·지연 판정)도 동일 규칙으로 재현합니다.
import { authEmail, authPassword, validateNewPassword } from "../account";
import { buildSeed, DemoStore } from "./seed";
import { validateContent } from "../rules";

const KEY = "lr-demo-v5";
type Row = Record<string, any>;
type Res = { data: any; error: { message: string } | null; count?: number | null };

let store: DemoStore = load();
function load(): DemoStore {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return buildSeed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } }
export function resetDemo() { store = buildSeed(); save(); }

const uuid = () => (crypto as any).randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
});
const err = (message: string): Res => ({ data: null, error: { message } });
const me = () => store.auth.session?.user.id ?? null;
const profile = (id: string | null) => store.tables.profiles.find((p) => p.id === id);
const isAdminOf = (cid: string) => { const p = profile(me()); return !!p && (p.role === "super_admin" || (p.role === "company_admin" && p.company_id === cid)); };

const PK: Record<string, string[]> = {
  group_members: ["profile_id"], attendance: ["session_id", "profile_id"], app_settings: ["id"],
  submissions: ["session_id", "profile_id", "form_type"], deadline_overrides: ["session_id", "profile_id", "form_type"],
  curricula: ["company_id", "group_id", "month"],
};

// ---- DB 트리거 재현 -------------------------------------------------------
function beforeWrite(table: string, row: Row, old: Row | null): string | null {
  const T = store.tables;
  if (table === "sessions") row.company_id = T.study_groups.find((g) => g.id === row.group_id)?.company_id;
  if (table === "deadline_overrides" || table === "attendance") row.company_id = T.sessions.find((s) => s.id === row.session_id)?.company_id;
  if (table === "submissions") {
    const s = T.sessions.find((x) => x.id === row.session_id);
    if (!s) return "회차를 찾을 수 없습니다.";
    row.company_id = s.company_id; row.month = s.month; row.updated_at = new Date().toISOString();
    if (row.profile_id !== me()) return "본인 제출물만 작성할 수 있습니다.";
    const now = new Date();
    if (now < new Date(s.open_at)) return "아직 열리지 않은 회차입니다.";
    const o = T.deadline_overrides.find((x) => x.session_id === row.session_id && x.profile_id === row.profile_id && x.form_type === row.form_type);
    const due = new Date(o?.new_due_at ?? (row.form_type === "post" ? s.post_due_at : s.pre_due_at));
    if (old && old.status === "submitted") {
      if (now > due) return "마감이 지나 잠긴 제출물입니다. 관리자에게 잠금 해제를 요청하세요.";
      const v = Object.values(validateContent(row.form_type, row.content ?? {}, T.app_settings[0] as any));
      if (v.length) return v[0];
      row.status = "submitted"; row.submitted_at = now.toISOString(); row.is_late = false; return null;
    }
    const fin = new Date(T.app_settings[0].final_deadline);
    if (now > fin && now > due) return "최종 마감일이 지나 제출할 수 없습니다.";
    if (row.status === "submitted") {
      const v = Object.values(validateContent(row.form_type, row.content ?? {}, T.app_settings[0] as any));
      if (v.length) return v[0];
      row.submitted_at = now.toISOString(); row.is_late = now > due;
    }
    else { row.submitted_at = null; row.is_late = false; }
  }
  if (table === "profiles" && old) {
    const p = profile(me());
    if (p && p.role !== "super_admin" && (row.role !== old.role || row.company_id !== old.company_id)) return "역할·소속 계열사 변경은 총괄 관리자만 할 수 있습니다.";
  }
  return null;
}
function afterWrite(table: string, row: Row) {
  if (table === "deadline_overrides") {
    const p = profile(row.profile_id);
    store.tables.audit_logs.push({ id: Date.now() + Math.random(), actor_id: me(), company_id: row.company_id, action: "기한 연장/잠금 해제",
      target: `${p?.name}(${p?.emp_no}) · ${row.form_type} → ${row.new_due_at.slice(0, 16)}`, reason: row.reason, created_at: new Date().toISOString() });
  }
}
function defaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  const base: Row = { ...row };
  if (!("id" in base) && !["group_members", "attendance", "app_settings"].includes(table)) base.id = ["audit_logs", "email_logs", "client_errors"].includes(table) ? Date.now() + Math.random() : uuid();
  if (table === "client_errors" && !base.created_at) base.created_at = now;
  if (table === "submissions") Object.assign(base, { content: base.content ?? {}, status: base.status ?? "draft", is_late: false, submitted_at: null });
  if (["companies", "study_groups", "sessions", "deadline_overrides", "audit_logs"].includes(table) && !base.created_at) base.created_at = now;
  if (table === "companies") base.per_group_curriculum ??= false, base.is_active ??= true, base.sort_order ??= 0;
  if (table === "study_groups") base.sort_order ??= 0, base.year ??= store.tables.app_settings[0].year;
  if (table === "curricula") base.group_id ??= null;
  return base;
}

// ---- Query builder -------------------------------------------------------
type Filter = (r: Row) => boolean;
class Query implements PromiseLike<Res> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: Filter[] = [];
  private orders: [string, boolean][] = [];
  private rng: [number, number] | null = null;
  private lim: number | null = null;
  private one: "single" | "maybe" | null = null;
  private payload: any = null;
  private conflict: string[] | null = null;
  private returning = false;
  private head = false;
  private wantCount = false;
  private cols: string[] | null = null;
  constructor(private table: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") { this.head = !!opts?.head; this.wantCount = !!opts?.count; } else this.returning = true;
    if (cols && cols !== "*" && !cols.includes("(")) this.cols = cols.split(",").map((c) => c.trim());
    return this;
  }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert"; this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = opts?.onConflict ? opts.onConflict.split(",").map((s) => s.trim()) : PK[this.table] ?? ["id"]; return this;
  }
  update(patch: Row) { this.op = "update"; this.payload = patch; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] <= v); return this; }
  gt(c: string, v: any) { this.filters.push((r) => r[c] > v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] < v); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push([c, o?.ascending !== false]); return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return new Promise<Res>((res) => setTimeout(() => res(this.run()), 40)).then(ok, bad);
  }

  private run(): Res {
    const T = store.tables as Record<string, Row[]>;
    if (!T[this.table]) return err(`unknown table ${this.table}`);
    const tab = T[this.table];
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];
    if (this.op === "select") out = tab.filter(match);
    if (this.op === "insert" || this.op === "upsert") {
      for (const raw of this.payload) {
        const keys = this.conflict ?? PK[this.table] ?? ["id"];
        const existing = this.op === "upsert" ? tab.find((r) => keys.every((k) => (r[k] ?? null) === (raw[k] ?? null))) : null;
        if (existing) {
          const next = { ...existing, ...raw };
          const e = beforeWrite(this.table, next, existing); if (e) return err(e);
          Object.assign(existing, next); afterWrite(this.table, existing); out.push(existing);
        } else {
          const row = defaults(this.table, raw);
          if (this.op === "insert" && PK[this.table] && tab.some((r) => PK[this.table].every((k) => (r[k] ?? null) === (row[k] ?? null)))) return err("duplicate key value violates unique constraint");
          const e = beforeWrite(this.table, row, null); if (e) return err(e);
          tab.push(row); afterWrite(this.table, row); out.push(row);
        }
      }
    }
    if (this.op === "update") {
      for (const r of tab.filter(match)) {
        const next = { ...r, ...this.payload };
        const e = beforeWrite(this.table, next, r); if (e) return err(e);
        Object.assign(r, next); afterWrite(this.table, r); out.push(r);
      }
    }
    if (this.op === "delete") {
      out = tab.filter(match);
      T[this.table] = tab.filter((r) => !match(r));
      if (this.table === "study_groups") {
        const ids = out.map((g) => g.id);
        T.group_members = T.group_members.filter((m) => !ids.includes(m.group_id));
        T.sessions = T.sessions.filter((s) => !ids.includes(s.group_id));
        T.curricula = T.curricula.filter((c) => !ids.includes(c.group_id));
      }
    }
    if (this.op !== "select") save();
    for (const [c, asc] of [...this.orders].reverse()) out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    const count = out.length;
    if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) out = out.slice(0, this.lim);
    let data: any = out.map((r) => (this.cols ? Object.fromEntries(this.cols.map((c) => [c, r[c]])) : { ...r }));
    data = JSON.parse(JSON.stringify(data));
    if (this.op !== "select" && !this.returning && !this.one) data = null;
    if (this.head) data = null;
    if (this.one) {
      if (data.length === 0) return this.one === "single" ? err("결과가 없습니다.") : { data: null, error: null };
      data = data[0];
    }
    return { data, error: null, count: this.wantCount ? count : null };
  }
}

// ---- auth / rpc / functions ----------------------------------------------
type AuthCb = (event: string, session: any) => void;
const listeners = new Set<AuthCb>();
const emit = (e: string) => listeners.forEach((cb) => cb(e, store.auth.session));
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

function rpc(name: string, args: Row = {}): PromiseLike<Res> {
  const L = store.login;
  const run = (): Res => {
    switch (name) {
      case "login_companies": return { data: store.tables.companies.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ code: c.code, name: c.name })), error: null };
      case "needs_setup": return { data: !store.tables.profiles.some((p) => p.role === "super_admin"), error: null };
      case "login_guard": { const r = L[args.p_email.toLowerCase()]; return { data: r?.locked_until && r.locked_until > Date.now() ? new Date(r.locked_until).toISOString() : null, error: null }; }
      case "login_failed": {
        const k = args.p_email.toLowerCase(); const r = (L[k] ??= { fail: 0, locked_until: 0 });
        if (r.locked_until && r.locked_until <= Date.now()) { r.fail = 0; r.locked_until = 0; }
        r.fail++; if (r.fail >= 5) { r.locked_until = Date.now() + 600000; r.fail = 0; }
        save(); return { data: r.locked_until ? new Date(r.locked_until).toISOString() : null, error: null };
      }
      case "login_ok": { const u = store.auth.users.find((x) => x.id === me()); if (u) delete L[u.email]; const p = profile(me()); if (p) p.last_seen_at = new Date().toISOString(); save(); return { data: null, error: null }; }
      case "touch_seen": { const p = profile(me()); if (p) { p.last_seen_at = new Date().toISOString(); save(); } return { data: null, error: null }; }
      case "agree_privacy": { const p = profile(me()); if (p && !p.privacy_agreed_at) { p.privacy_agreed_at = new Date().toISOString(); save(); } return { data: null, error: null }; }
      case "public_info": { const s = store.tables.app_settings[0]; return { data: [{ contact_email: s.contact_email, contact_phone: s.contact_phone, privacy_officer: s.privacy_officer, retention_text: s.retention_text, year: s.year }], error: null }; }
      case "purge_year": {
        if (profile(me())?.role !== "super_admin") return err("총괄 관리자만 실행할 수 있습니다.");
        const T = store.tables; const gids = T.study_groups.filter((g) => g.year === args.p_year).map((g) => g.id);
        const sids = T.sessions.filter((x) => gids.includes(x.group_id)).map((x) => x.id);
        const n = T.submissions.filter((x) => sids.includes(x.session_id)).length;
        T.study_groups = T.study_groups.filter((g) => !gids.includes(g.id)); T.group_members = T.group_members.filter((m) => !gids.includes(m.group_id));
        T.sessions = T.sessions.filter((x) => !sids.includes(x.id)); T.submissions = T.submissions.filter((x) => !sids.includes(x.session_id));
        T.attendance = T.attendance.filter((x) => !sids.includes(x.session_id)); T.deadline_overrides = T.deadline_overrides.filter((x) => !sids.includes(x.session_id));
        T.curricula = T.curricula.filter((c) => !c.group_id || !gids.includes(c.group_id));
        T.audit_logs.push({ id: Date.now(), actor_id: me(), company_id: null, action: "연도 데이터 파기", target: `${args.p_year}년 그룹·회차 및 제출물 ${n}건`, reason: null, created_at: new Date().toISOString() });
        save(); return { data: n, error: null };
      }
      case "set_session_topic": {
        const s = store.tables.sessions.find((x) => x.id === args.p_session);
        if (!s || !(s.facilitator_id === me() || isAdminOf(s.company_id))) return err("발제 주제를 등록할 권한이 없습니다.");
        s.topic = args.p_topic; save(); return { data: null, error: null };
      }
    }
    return err(`unknown rpc ${name}`);
  };
  return delay(run());
}

async function invoke(name: string, { body }: { body: Row }): Promise<{ data: any; error: any }> {
  await delay(null);
  const T = store.tables;
  const caller = profile(me());
  const fail = (m: string) => ({ data: { error: m }, error: { message: m, context: null } });
  const audit = (company_id: string | null, action: string, target: string, reason?: string) =>
    T.audit_logs.push({ id: Date.now() + Math.random(), actor_id: me(), company_id, action, target, reason: reason ?? null, created_at: new Date().toISOString() });

  if (name === "change-password") {
    if (!caller) return fail("로그인이 필요합니다.");
    const u = store.auth.users.find((x) => x.id === caller.id)!;
    const pe = validateNewPassword(String(body.next ?? ""), caller.emp_no); if (pe) return fail(pe);
    if (body.current === body.next) return fail("현재 비밀번호와 다른 비밀번호를 입력하세요.");
    if (u.password !== authPassword(String(body.current ?? ""))) return fail("현재 비밀번호가 올바르지 않습니다.");
    u.password = authPassword(body.next); caller.must_change_password = false; save(); return { data: { ok: true }, error: null };
  }
  if (name === "admin-users") {
    if (body.action === "bootstrap") return fail("데모에서는 초기 설정이 이미 완료되어 있습니다.");
    if (!caller || caller.role === "user") return fail("관리자만 사용할 수 있습니다.");
    if (body.action === "create") {
      const comp = T.companies.find((c) => c.id === body.company_id);
      if (!comp || !isAdminOf(comp.id)) return fail("해당 계열사 권한이 없습니다.");
      const results: any[] = [];
      for (const r of body.rows ?? []) {
        const emp = String(r.emp_no ?? "").trim(), nm = String(r.name ?? "").trim();
        if (!emp || !nm) { results.push({ emp_no: emp, ok: false, error: "사번·성명 필수" }); continue; }
        if (!["대표급", "본부장급", "팀장급"].includes(r.rank_level)) { results.push({ emp_no: emp, ok: false, error: "직급구분은 대표급/본부장급/팀장급" }); continue; }
        const email = authEmail(comp.code, emp);
        if (store.auth.users.some((u) => u.email === email)) { results.push({ emp_no: emp, ok: false, error: "이미 등록된 사번" }); continue; }
        const id = uuid();
        store.auth.users.push({ id, email, password: authPassword(emp) });
        T.profiles.push({ id, company_id: comp.id, emp_no: emp, name: nm, rank_level: r.rank_level, position: r.position || null, department: r.department || null,
          notify_email: r.notify_email || null, role: "user", is_participant: true, must_change_password: true, is_active: true, created_at: new Date().toISOString() });
        if (r.group_name) {
          let g = T.study_groups.find((x) => x.company_id === comp.id && x.name === r.group_name);
          if (!g) { g = defaults("study_groups", { company_id: comp.id, name: r.group_name }); T.study_groups.push(g); }
          T.group_members.push({ profile_id: id, group_id: g.id, assigned_at: new Date().toISOString() });
        }
        results.push({ emp_no: emp, ok: true });
      }
      audit(comp.id, "대상자 등록", `${results.filter((x) => x.ok).length}명 등록 / ${results.filter((x) => !x.ok).length}건 오류`);
      save(); return { data: { results }, error: null };
    }
    const t = profile(body.profile_id); if (!t) return fail("대상자를 찾을 수 없습니다.");
    if (!isAdminOf(t.company_id)) return fail("해당 계열사 권한이 없습니다.");
    const who = `${t.name}(${t.emp_no})`;
    const u = store.auth.users.find((x) => x.id === t.id)!;
    if (body.action === "reset_password") { u.password = authPassword(t.emp_no); t.must_change_password = true; delete store.login[u.email]; audit(t.company_id, "비밀번호 초기화", who, body.reason); }
    else if (body.action === "set_active") { t.is_active = !!body.active; audit(t.company_id, body.active ? "계정 활성화" : "계정 비활성(대상 제외)", who, body.reason); }
    else if (body.action === "set_role") { if (caller.role !== "super_admin") return fail("총괄 관리자만 역할을 바꿀 수 있습니다."); t.role = body.role; audit(t.company_id, "역할 변경", `${who} → ${body.role}`); }
    else if (body.action === "move_company") {
      if (caller.role !== "super_admin") return fail("계열사 이동은 총괄 관리자만 할 수 있습니다.");
      const to = T.companies.find((c) => c.id === body.company_id); if (!to) return fail("이동할 계열사를 찾을 수 없습니다.");
      u.email = authEmail(to.code, t.emp_no); T.group_members = T.group_members.filter((m) => m.profile_id !== t.id); t.company_id = to.id;
      audit(to.id, "계열사 이동", `${who} → ${to.name}`, body.reason);
    } else return fail("알 수 없는 작업입니다.");
    save(); return { data: { ok: true }, error: null };
  }
  if (name === "notify") {
    if (!caller || caller.role === "user") return fail("관리자만 사용할 수 있습니다.");
    let skipped = 0;
    for (const pid of body.profile_ids ?? []) {
      const p = profile(pid); if (!p) continue;
      T.email_logs.push({ id: Date.now() + Math.random(), profile_id: p.id, company_id: p.company_id, type: body.mode === "accounts" ? "account" : "manual",
        session_id: body.session_id ?? null, to_email: p.notify_email, result: "skipped", error: "데모 모드(실제 발송 안 함)", sent_at: new Date().toISOString() });
      skipped++;
    }
    save(); return { data: { sent: 0, skipped, failed: 0 }, error: null };
  }
  return fail(`unknown function ${name}`);
}

export function createDemoClient() {
  return {
    from: (t: string) => new Query(t),
    rpc,
    functions: { invoke },
    auth: {
      async getSession() { return { data: { session: store.auth.session }, error: null }; },
      onAuthStateChange(cb: AuthCb) { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        await delay(null);
        const u = store.auth.users.find((x) => x.email === email.toLowerCase() && x.password === password);
        const p = u && profile(u.id);
        if (!u || !p || !p.is_active) return { data: { session: null }, error: { message: "Invalid login credentials" } };
        store.auth.session = { user: { id: u.id, email: u.email }, access_token: "demo" }; save(); emit("SIGNED_IN");
        return { data: { session: store.auth.session }, error: null };
      },
      async signOut() { store.auth.session = null; save(); emit("SIGNED_OUT"); return { error: null }; },
    },
  };
}

/** 데모 빠른 로그인 계정 */
export function demoAccounts() {
  const T = store.tables;
  const find = (role: string, extra?: (p: Row) => boolean) => T.profiles.find((p) => p.role === role && p.is_active && (!extra || extra(p)));
  const code = (p?: Row) => T.companies.find((c) => c.id === p?.company_id)?.code;
  const list = [
    { label: "참가자", hint: "본부장·팀장급", p: T.profiles.find((p) => p.emp_no === "1001") },
    { label: "각 사 관리자", hint: "계열사 HR", p: find("company_admin", (p) => !p.is_participant) },
    { label: "총괄 관리자", hint: "인재경영실", p: find("super_admin") },
  ];
  return list.filter((x) => x.p).map((x) => ({ ...x, code: code(x.p)!, emp: x.p!.emp_no as string }));
}
export const demoPasswordOf = (code: string, emp: string) => {
  const u = store.auth.users.find((x) => x.email === authEmail(code, emp));
  return u?.password?.replace(/^rd!/, "") ?? emp;
};
