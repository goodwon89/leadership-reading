// 계정 관리 서버 함수: 초기 설정 / 일괄 등록 / 비밀번호 초기화 / 비활성 / 계열사 이동 / 퇴사 처리
import {
  admin, audit, authEmail, authPassword, canManage, corsHeaders, getCaller, json,
} from "../_shared/common.ts";

type Row = {
  emp_no: string; name: string; rank_level: string; position?: string;
  department?: string; notify_email?: string; group_name?: string;
};

const RANKS = ["대표급", "본부장급", "팀장급"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = admin();
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청입니다." }, 400); }
  const action = body.action as string;

  // ---- 최초 설정: 총괄 관리자가 한 명도 없을 때만 허용 -------------------
  if (action === "bootstrap") {
    const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) > 0) return json({ error: "이미 초기 설정이 완료되었습니다." }, 403);
    // 설치 코드: Edge Function 환경변수 BOOTSTRAP_CODE 와 같아야 총괄 관리자를 만들 수 있음
    const setupCode = Deno.env.get("BOOTSTRAP_CODE") ?? "";
    if (!setupCode) return json({ error: "서버에 설치 코드(BOOTSTRAP_CODE)가 설정되지 않았습니다. README 1-3을 확인하세요." }, 403);
    if (String(body.setup_code ?? "") !== setupCode) return json({ error: "설치 코드가 올바르지 않습니다." }, 403);
    const { company_code, company_name, emp_no, name, notify_email } = body;
    if (!company_code || !company_name || !emp_no || !name) return json({ error: "필수 항목이 비어 있습니다." }, 400);
    let { data: comp } = await db.from("companies").select("*").eq("code", company_code).maybeSingle();
    if (!comp) {
      const r = await db.from("companies").insert({ code: company_code, name: company_name, sort_order: 1 }).select().single();
      if (r.error) return json({ error: r.error.message }, 400);
      comp = r.data;
    }
    const u = await db.auth.admin.createUser({
      email: authEmail(company_code, emp_no), password: authPassword(String(emp_no)), email_confirm: true,
    });
    if (u.error) return json({ error: u.error.message }, 400);
    const p = await db.from("profiles").insert({
      id: u.data.user.id, company_id: comp.id, emp_no, name, rank_level: "팀장급",
      notify_email: notify_email || null, role: "super_admin", is_participant: false,
    });
    if (p.error) { await db.auth.admin.deleteUser(u.data.user.id); return json({ error: p.error.message }, 400); }
    return json({ ok: true });
  }

  const caller = await getCaller(req, db);
  if (!caller || caller.role === "user") return json({ error: "관리자만 사용할 수 있습니다." }, 403);

  // ---- 대상자 일괄 등록 --------------------------------------------------
  if (action === "create") {
    const companyId = body.company_id as string;
    if (!canManage(caller, companyId)) return json({ error: "해당 계열사 권한이 없습니다." }, 403);
    const { data: comp } = await db.from("companies").select("code").eq("id", companyId).single();
    if (!comp) return json({ error: "계열사를 찾을 수 없습니다." }, 404);
    const { data: settings } = await db.from("app_settings").select("year").eq("id", 1).single();
    const results: { emp_no: string; ok: boolean; error?: string }[] = [];
    const groupCache = new Map<string, string>();

    for (const raw of (body.rows ?? []) as Row[]) {
      const r = { ...raw, emp_no: String(raw.emp_no ?? "").trim(), name: String(raw.name ?? "").trim() };
      if (!r.emp_no || !r.name) { results.push({ emp_no: r.emp_no, ok: false, error: "사번·성명 필수" }); continue; }
      if (!RANKS.includes(r.rank_level)) { results.push({ emp_no: r.emp_no, ok: false, error: "직급구분은 대표급/본부장급/팀장급" }); continue; }
      const u = await db.auth.admin.createUser({
        email: authEmail(comp.code, r.emp_no), password: authPassword(r.emp_no), email_confirm: true,
      });
      if (u.error) {
        results.push({ emp_no: r.emp_no, ok: false, error: /already/i.test(u.error.message) ? "이미 등록된 사번" : u.error.message });
        continue;
      }
      const p = await db.from("profiles").insert({
        id: u.data.user.id, company_id: companyId, emp_no: r.emp_no, name: r.name, rank_level: r.rank_level,
        position: r.position || null, department: r.department || null, notify_email: r.notify_email || null,
      });
      if (p.error) {
        await db.auth.admin.deleteUser(u.data.user.id);
        results.push({ emp_no: r.emp_no, ok: false, error: p.error.message });
        continue;
      }
      if (r.group_name) {
        let gid = groupCache.get(r.group_name);
        if (!gid) {
          const { data: g } = await db.from("study_groups").select("id").eq("company_id", companyId).eq("name", r.group_name).maybeSingle();
          gid = g?.id ?? (await db.from("study_groups").insert({ company_id: companyId, name: r.group_name, year: settings?.year ?? 2027 }).select("id").single()).data?.id;
          if (gid) groupCache.set(r.group_name, gid);
        }
        if (gid) await db.from("group_members").upsert({ profile_id: u.data.user.id, group_id: gid });
      }
      results.push({ emp_no: r.emp_no, ok: true });
    }
    const okCount = results.filter((x) => x.ok).length;
    await audit(db, caller.id, companyId, "대상자 등록", `${okCount}명 등록 / ${results.length - okCount}건 오류`);
    return json({ results });
  }

  // 이하 개별 계정 작업
  const { data: target } = await db.from("profiles").select("*").eq("id", body.profile_id).single();
  if (!target) return json({ error: "대상자를 찾을 수 없습니다." }, 404);
  if (!canManage(caller, target.company_id)) return json({ error: "해당 계열사 권한이 없습니다." }, 403);
  const who = `${target.name}(${target.emp_no})`;

  if (action === "reset_password") {
    const r = await db.auth.admin.updateUserById(target.id, { password: authPassword(target.emp_no) });
    if (r.error) return json({ error: r.error.message }, 400);
    await db.from("profiles").update({ must_change_password: true }).eq("id", target.id);
    const { data: comp } = await db.from("companies").select("code").eq("id", target.company_id).single();
    if (comp) await db.from("login_attempts").delete().eq("email", authEmail(comp.code, target.emp_no));
    await audit(db, caller.id, target.company_id, "비밀번호 초기화", who, body.reason);
    return json({ ok: true });
  }

  if (action === "set_active") {
    const active = !!body.active;
    await db.auth.admin.updateUserById(target.id, { ban_duration: active ? "none" : "876000h" });
    await db.from("profiles").update({ is_active: active }).eq("id", target.id);
    await audit(db, caller.id, target.company_id, active ? "계정 활성화" : "계정 비활성(대상 제외)", who, body.reason);
    return json({ ok: true });
  }

  if (action === "set_role") {
    if (caller.role !== "super_admin") return json({ error: "총괄 관리자만 역할을 바꿀 수 있습니다." }, 403);
    if (!["user", "company_admin", "super_admin"].includes(body.role)) return json({ error: "잘못된 역할" }, 400);
    await db.from("profiles").update({ role: body.role }).eq("id", target.id);
    await audit(db, caller.id, target.company_id, "역할 변경", `${who} → ${body.role}`);
    return json({ ok: true });
  }

  if (action === "move_company") {
    if (caller.role !== "super_admin") return json({ error: "계열사 이동은 총괄 관리자만 할 수 있습니다." }, 403);
    const { data: to } = await db.from("companies").select("id, code, name").eq("id", body.company_id).single();
    if (!to) return json({ error: "이동할 계열사를 찾을 수 없습니다." }, 404);
    const r = await db.auth.admin.updateUserById(target.id, { email: authEmail(to.code, target.emp_no), email_confirm: true } as any);
    if (r.error) return json({ error: r.error.message }, 400);
    await db.from("group_members").delete().eq("profile_id", target.id);
    await db.from("profiles").update({ company_id: to.id }).eq("id", target.id);
    await audit(db, caller.id, to.id, "계열사 이동", `${who} → ${to.name}`, body.reason);
    return json({ ok: true });
  }

  // ---- 퇴사 처리: 계정과 교육 기록을 복구할 수 없게 삭제 (개인정보 보관 기간 = 퇴사 시점까지) ----
  if (action === "purge") {
    if (target.id === caller.id) return json({ error: "본인 계정은 퇴사 처리할 수 없습니다." }, 400);
    if (target.role === "super_admin") return json({ error: "총괄 관리자 계정은 퇴사 처리할 수 없습니다." }, 403);
    if (target.role === "company_admin" && caller.role !== "super_admin") {
      return json({ error: "관리자 계정의 퇴사 처리는 총괄 관리자만 할 수 있습니다." }, 403);
    }
    if (String(body.confirm_emp_no ?? "").trim() !== target.emp_no) return json({ error: "확인용 사번이 일치하지 않습니다." }, 400);
    const { count } = await db.from("submissions").select("id", { count: "exact", head: true }).eq("profile_id", target.id);
    // 다른 사람에게 준 기한 연장 기록은 남기되 부여자만 비움
    await db.from("deadline_overrides").update({ granted_by: null }).eq("granted_by", target.id);
    const { data: comp } = await db.from("companies").select("code").eq("id", target.company_id).single();
    if (comp) await db.from("login_attempts").delete().eq("email", authEmail(comp.code, target.emp_no));
    // auth 계정 삭제 → profiles 및 제출물·출석·그룹 배정·기한 연장이 연쇄 삭제됨
    const r = await db.auth.admin.deleteUser(target.id);
    if (r.error) return json({ error: r.error.message }, 400);
    await db.from("profiles").delete().eq("id", target.id); // 연쇄 삭제가 안 된 경우 대비
    // 감사 기록에는 성명을 남기지 않고 사번과 삭제 건수만 기록
    await audit(db, caller.id, target.company_id, "퇴사 처리(기록 삭제)", `사번 ${target.emp_no} · 제출물 ${count ?? 0}건 삭제`, body.reason);
    return json({ ok: true, deleted_submissions: count ?? 0 });
  }

  return json({ error: "알 수 없는 작업입니다." }, 400);
});
