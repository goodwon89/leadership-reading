import { db, fetchAll, must } from "./supabase";
import type { Dataset } from "./metrics";
import type { Book, Company, Curriculum, Group, Member, Override, Profile, Session, Settings, Submission } from "./types";

export const SUB_COLS = "id,session_id,profile_id,company_id,month,form_type,status,submitted_at,is_late,updated_at";

/** 관리자용: 계열사(또는 전체) 데이터 묶음. 제출물 본문은 제외(필요 시 별도 조회) */
export async function loadDataset(companyId: string | null): Promise<Dataset> {
  const scoped = (t: string, cols = "*") => () => {
    let q = db.from(t).select(cols);
    if (companyId) q = q.eq("company_id", companyId);
    return q;
  };
  const [companies, profiles, groups, sessions, curricula, submissions, overrides, books, settings, membersAll] = await Promise.all([
    fetchAll<Company>(() => db.from("companies").select("*").order("sort_order")),
    fetchAll<Profile>(() => scoped("profiles")().order("emp_no")),
    fetchAll<Group>(() => scoped("study_groups")().order("sort_order")),
    fetchAll<Session>(() => scoped("sessions")().order("month")),
    fetchAll<Curriculum>(scoped("curricula")),
    fetchAll<Submission>(scoped("submissions", SUB_COLS)),
    fetchAll<Override>(scoped("deadline_overrides")),
    must<Book[]>(db.from("books").select("*").order("no")),
    must<Settings>(db.from("app_settings").select("*").eq("id", 1).single()),
    fetchAll<Member>(() => db.from("group_members").select("*")),
  ]);
  const gids = new Set(groups.map((g) => g.id));
  return { companies, profiles, groups, members: membersAll.filter((m) => gids.has(m.group_id)), sessions, curricula, submissions, overrides, books, settings };
}

/** 참가자용: 내 그룹·내 제출물(본문 포함)·그룹 구성원 */
export async function loadMine(me: Profile): Promise<Dataset & { group: Group | null }> {
  const member = await must<Member | null>(db.from("group_members").select("*").eq("profile_id", me.id).maybeSingle());
  const gid = member?.group_id ?? null;
  const [companies, group, sessions, curricula, submissions, overrides, books, settings, peers] = await Promise.all([
    must<Company[]>(db.from("companies").select("*").eq("id", me.company_id)),
    gid ? must<Group>(db.from("study_groups").select("*").eq("id", gid).single()) : Promise.resolve(null),
    gid ? must<Session[]>(db.from("sessions").select("*").eq("group_id", gid).order("month")) : Promise.resolve([]),
    must<Curriculum[]>(db.from("curricula").select("*").eq("company_id", me.company_id)),
    must<Submission[]>(db.from("submissions").select("*").eq("profile_id", me.id)),
    must<Override[]>(db.from("deadline_overrides").select("*").eq("profile_id", me.id)),
    must<Book[]>(db.from("books").select("*").order("no")),
    must<Settings>(db.from("app_settings").select("*").eq("id", 1).single()),
    gid ? must<Member[]>(db.from("group_members").select("*").eq("group_id", gid)) : Promise.resolve([] as Member[]),
  ]);
  const peerIds = peers.map((m) => m.profile_id);
  const profiles = peerIds.length ? await must<Profile[]>(db.from("profiles").select("*").in("id", peerIds)) : [me];
  if (!profiles.some((p) => p.id === me.id)) profiles.push(me);
  return { companies, group, groups: group ? [group] : [], members: peers.length ? peers : (member ? [member] : []), profiles, sessions, curricula, submissions, overrides, books, settings };
}

export async function audit(companyId: string | null, action: string, target: string, reason?: string) {
  const { data } = await db.auth.getSession();
  const actor = data?.session?.user?.id;
  if (!actor) return;
  await db.from("audit_logs").insert({ actor_id: actor, company_id: companyId, action, target, reason: reason ?? null });
}
