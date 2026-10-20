// 화면 오류 기록: 로그인한 사용자의 오류를 client_errors 표에 남김 (세션당 최대 10건, 같은 오류는 1번)
import { db } from "./supabase";

const seen = new Set<string>();
let count = 0;

export async function logError(message: string, detail?: string) {
  try {
    const key = message.slice(0, 200);
    if (seen.has(key) || count >= 10) return;
    seen.add(key); count++;
    const { data } = await db.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) return;
    await db.from("client_errors").insert({
      profile_id: uid, message: message.slice(0, 2000), detail: (detail ?? "").slice(0, 8000),
      url: location.href.slice(0, 500), user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch { /* 기록 실패는 무시 */ }
}

export function installErrorLogging() {
  window.addEventListener("error", (e) => logError(e.message || "Error", e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    logError(r?.message ?? String(r ?? "unhandledrejection"), r?.stack);
  });
}
