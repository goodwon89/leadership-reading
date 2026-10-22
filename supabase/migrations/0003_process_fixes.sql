-- 0003: 2026-10-22 전체 프로세스 점검 반영
-- 1) 과제(post)는 '교육 후' 양식 → 토론 시작 시각(meet_at) 이전에는 작성·제출 불가
-- 2) 메일 발송 미사용 결정 → 본인 정보 변경 오류 문구 정리, 자동 메일 기본값 끔
-- Supabase 대시보드 SQL Editor에서 한 번 실행하면 됩니다 (여러 번 실행해도 안전).

create or replace function public.submissions_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s record;
  due timestamptz;
  fin timestamptz;
  err text;
begin
  select * into s from sessions where id = new.session_id;
  if s is null then raise exception '회차를 찾을 수 없습니다.'; end if;
  new.company_id := s.company_id;
  new.month := s.month;
  new.updated_at := now();

  if auth.uid() is null then return new; end if;  -- 서버 함수/관리 작업은 통과

  if new.profile_id <> auth.uid() then
    raise exception '본인 제출물만 작성할 수 있습니다.';
  end if;
  if now() < s.open_at then
    raise exception '아직 열리지 않은 회차입니다.';
  end if;
  if new.form_type = 'post' and now() < s.meet_at then
    raise exception '과제는 토론 이후에 작성할 수 있습니다.';
  end if;

  due := public.effective_due(new.session_id, new.profile_id, new.form_type);
  select final_deadline into fin from app_settings where id = 1;
  if pg_column_size(new.content) > 60000 then raise exception '내용이 너무 깁니다.'; end if;

  if tg_op = 'UPDATE' and old.status = 'submitted' then
    if now() > due then
      raise exception '마감이 지나 잠긴 제출물입니다. 관리자에게 잠금 해제를 요청하세요.';
    end if;
    err := public.validate_submission(new.form_type, new.content);
    if err is not null then raise exception '%', err; end if;
    new.status := 'submitted';                -- 제출 후 임시저장으로 되돌리지 않음
    new.submitted_at := now();
    new.is_late := false;
    return new;
  end if;

  if fin is not null and now() > fin and now() > due then
    raise exception '최종 마감일이 지나 제출할 수 없습니다.';
  end if;

  if new.status = 'submitted' then
    err := public.validate_submission(new.form_type, new.content);
    if err is not null then raise exception '%', err; end if;
    new.submitted_at := now();
    new.is_late := now() > due;
  else
    new.submitted_at := null;
    new.is_late := false;
  end if;
  return new;
end $$;

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;          -- service role(서버 함수)은 통과
  if public.is_super() then return new; end if;
  if public.is_admin_of(old.company_id) then
    if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
      raise exception '역할·소속 계열사 변경은 총괄 관리자만 할 수 있습니다.';
    end if;
    return new;
  end if;
  -- 본인: 알림 메일만 변경 가능
  if old.id = auth.uid() then
    if (new.company_id, new.emp_no, new.name, new.rank_level, new.position, new.department,
        new.role, new.is_participant, new.must_change_password, new.is_active)
       is distinct from
       (old.company_id, old.emp_no, old.name, old.rank_level, old.position, old.department,
        old.role, old.is_participant, old.must_change_password, old.is_active) then
      raise exception '본인 정보는 소속사 HR 담당자만 변경할 수 있습니다.';
    end if;
    return new;
  end if;
  raise exception '권한이 없습니다.';
end $$;

alter table public.app_settings alter column mail_enabled set default false;
update public.app_settings set mail_enabled = false where id = 1;
