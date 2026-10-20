// 공통 유틸: CORS, Supabase 클라이언트, 호출자 확인, 계정 규칙
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
export const AUTH_EMAIL_DOMAIN = Deno.env.get("AUTH_EMAIL_DOMAIN") ?? "reading.sangsangin.local";

// 프런트엔드(src/lib/account.ts)와 반드시 같은 규칙을 사용합니다.
export const PW_PREFIX = "rd!";
export const authEmail = (companyCode: string, empNo: string) =>
  `${companyCode}_${empNo}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "") + "@" + AUTH_EMAIL_DOMAIN;
export const authPassword = (typed: string) => PW_PREFIX + typed;

export function validateNewPassword(pw: string, empNo: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "영문과 숫자를 모두 포함해야 합니다.";
  if (pw === empNo) return "사번과 같은 비밀번호는 사용할 수 없습니다.";
  return null;
}

export const admin = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export type Caller = {
  id: string;
  company_id: string;
  emp_no: string;
  name: string;
  role: "user" | "company_admin" | "super_admin";
  is_active: boolean;
};

/** Authorization 헤더의 JWT로 호출자를 확인하고 profile을 돌려줍니다. */
export async function getCaller(req: Request, db: SupabaseClient): Promise<Caller | null> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: p } = await db.from("profiles")
    .select("id, company_id, emp_no, name, role, is_active").eq("id", data.user.id).single();
  if (!p || !p.is_active) return null;
  return p as Caller;
}

export const canManage = (c: Caller, companyId: string) =>
  c.role === "super_admin" || (c.role === "company_admin" && c.company_id === companyId);

export async function audit(db: SupabaseClient, actor: string | null, companyId: string | null,
  action: string, target: string, reason?: string) {
  await db.from("audit_logs").insert({ actor_id: actor, company_id: companyId, action, target, reason: reason ?? null });
}
