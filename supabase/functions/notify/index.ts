// 메일 발송 사용 안 함 (2026-10-21 결정: 외부 메일 발송 업체 미사용, 안내는 플랫폼 화면과 관리자의 사내 메일로)
// 예약 실행(pg_cron)이 남아 있어도 아무 일도 하지 않고 끝나도록 둔 자리 표시 함수입니다.
// 이전 발송 코드는 git 기록(커밋 '퇴사 처리(계정·교육 기록 삭제) 기능…' 이전)에서 찾을 수 있습니다.
import { corsHeaders, json } from "../_shared/common.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return json({ ok: true, sent: 0, skipped: 0, failed: 0, note: "메일 발송을 사용하지 않습니다." });
});
