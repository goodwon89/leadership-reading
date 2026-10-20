// 계정 규칙 — supabase/functions/_shared/common.ts 와 반드시 동일하게 유지
export const AUTH_EMAIL_DOMAIN = (import.meta.env.VITE_AUTH_EMAIL_DOMAIN as string) || "reading.sangsangin.local";
export const PW_PREFIX = "rd!"; // 짧은 사번도 최초 비밀번호로 쓸 수 있도록 내부 접두어를 붙임

export const authEmail = (companyCode: string, empNo: string) =>
  `${companyCode}_${empNo}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "") + "@" + AUTH_EMAIL_DOMAIN;
export const authPassword = (typed: string) => PW_PREFIX + typed;

export function validateNewPassword(pw: string, empNo: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "영문과 숫자를 모두 포함해야 합니다.";
  if (pw === empNo) return "사번과 같은 비밀번호는 사용할 수 없습니다.";
  return null;
}
