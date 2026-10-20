import { createClient } from "@supabase/supabase-js";
import { createDemoClient } from "./demo/client";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase 설정이 없거나 VITE_DEMO=1 이면 데모 모드 */
export const DEMO = import.meta.env.VITE_DEMO === "1" || !url || !key;

// 앱 코드는 supabase-js 와 같은 사용법으로 db 를 호출합니다.
export const db: any = DEMO ? createDemoClient() : createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });

/** 오류 메시지를 사용자용 문장으로 */
export function errMsg(e: any): string {
  const m = e?.message ?? String(e ?? "");
  if (/Invalid login credentials/i.test(m)) return "사번 또는 비밀번호가 올바르지 않습니다.";
  if (/row-level security/i.test(m)) return "권한이 없습니다.";
  if (/duplicate key/i.test(m)) return "이미 존재하는 항목입니다.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "네트워크 연결을 확인해 주세요.";
  return m || "알 수 없는 오류가 발생했습니다.";
}

/** Edge Function 호출 — 함수가 돌려준 { error } 메시지까지 꺼냄 */
export async function callFn<T = any>(name: string, body: Record<string, any>): Promise<T> {
  const { data, error } = await db.functions.invoke(name, { body });
  if (error) {
    let msg = data?.error;
    try { if (!msg && error.context?.json) msg = (await error.context.json())?.error; } catch { /* ignore */ }
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** 1,000행 제한을 넘는 조회를 위해 페이지 단위로 모두 가져옴 */
export async function fetchAll<T = any>(build: () => any, page = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function must<T = any>(q: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
