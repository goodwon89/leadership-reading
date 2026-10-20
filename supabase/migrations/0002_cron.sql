-- =====================================================================
-- 매일 09:00(KST) 메일 알림 예약 작업
-- 실행 전: Supabase 대시보드 > Database > Extensions 에서 pg_cron, pg_net 활성화
-- 아래 <PROJECT_REF>, <CRON_SECRET> 두 곳을 실제 값으로 바꾼 뒤 SQL Editor에서 실행하세요.
--   <PROJECT_REF> : 프로젝트 URL https://<PROJECT_REF>.supabase.co 의 앞부분
--   <CRON_SECRET> : Edge Function 환경변수 CRON_SECRET 에 넣은 임의의 긴 문자열
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-reading-notify',
  '0 0 * * *',            -- UTC 00:00 = KST 09:00
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := jsonb_build_object('mode','cron')
  );
  $$
);

-- 확인: select * from cron.job;
-- 해제: select cron.unschedule('daily-reading-notify');
