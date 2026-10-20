// 비밀번호 변경: 현재 비밀번호 확인 → 정책 검증 → 변경 → 변경 필요 플래그 해제
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  admin, ANON_KEY, authPassword, corsHeaders, getCaller, json, SUPABASE_URL, validateNewPassword,
} from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = admin();
  const caller = await getCaller(req, db);
  if (!caller) return json({ error: "로그인이 필요합니다." }, 401);

  const { current, next } = await req.json();
  const policy = validateNewPassword(String(next ?? ""), caller.emp_no);
  if (policy) return json({ error: policy }, 400);
  if (current === next) return json({ error: "현재 비밀번호와 다른 비밀번호를 입력하세요." }, 400);

  // 현재 비밀번호 확인
  const { data: u } = await db.auth.admin.getUserById(caller.id);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const check = await anon.auth.signInWithPassword({ email: u.user!.email!, password: authPassword(String(current ?? "")) });
  if (check.error) return json({ error: "현재 비밀번호가 올바르지 않습니다." }, 400);

  const r = await db.auth.admin.updateUserById(caller.id, { password: authPassword(next) });
  if (r.error) return json({ error: r.error.message }, 400);
  await db.from("profiles").update({ must_change_password: false }).eq("id", caller.id);
  return json({ ok: true });
});
