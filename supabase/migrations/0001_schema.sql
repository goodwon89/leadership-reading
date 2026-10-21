-- =====================================================================
-- '27 리더십 2년차 독서교육 플랫폼 — 스키마 / 권한(RLS) / 트리거 / RPC
-- Supabase SQL Editor에서 한 번에 실행하세요. (재실행 안전하지 않음: 최초 1회)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                     -- 로그인 시 사용하는 계열사 코드 (영문/숫자)
  name text not null,
  sort_order int not null default 0,
  per_group_curriculum boolean not null default false, -- 그룹별 도서 순서 허용
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  emp_no text not null,
  name text not null,
  rank_level text not null check (rank_level in ('대표급','본부장급','팀장급')),
  position text,
  department text,
  notify_email text,
  role text not null default 'user' check (role in ('user','company_admin','super_admin')),
  is_participant boolean not null default true,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  privacy_agreed_at timestamptz,              -- 개인정보 수집·이용 확인 일시
  last_seen_at timestamptz,                   -- 최근 접속 (로그인·앱 열기, 하루 1회 갱신)
  created_at timestamptz not null default now(),
  unique (company_id, emp_no)
);

create table public.books (
  id int primary key,
  no int not null unique,
  category text not null check (category in ('경영','인문')),
  title text not null,
  author text not null,
  summary text,
  recommended_by text,
  cover_url text
);

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  year int not null default 2027,
  open_offset_days int not null default 14,     -- 토론일 D-14 오픈
  pre_due_offset_days int not null default 1,   -- 사전학습·발표자료 D-1 23:59
  post_due_offset_days int not null default 7,  -- 과제 D+7 23:59
  final_deadline timestamptz not null default '2027-12-31 23:59:59+09',
  summary_min int not null default 250,
  summary_max int not null default 400,
  field_min int not null default 50,
  mail_enabled boolean not null default false,
  app_url text,
  contact_email text,                         -- 푸터·개인정보 안내에 표시할 문의처
  contact_phone text,
  privacy_officer text,                       -- 개인정보 보호 담당 (부서·성명)
  retention_text text not null default '퇴사 시점까지',
  updated_at timestamptz not null default now()
);

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  year int not null default 2027,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 한 사용자는 1개 그룹에만 소속 (이동 시 행을 갱신, 이전 회차 기록은 sessions 쪽에 남음)
create table public.group_members (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  group_id uuid not null references public.study_groups(id) on delete cascade,
  assigned_at timestamptz not null default now()
);

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid references public.study_groups(id) on delete cascade, -- null = 계열사 공통
  month int not null check (month between 1 and 12),
  book_id int not null references public.books(id)
);
create unique index curricula_scope_month on public.curricula
  (company_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), month);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  month int not null check (month between 1 and 12),
  meet_at timestamptz not null,
  place text,
  online_url text,
  facilitator_id uuid references public.profiles(id) on delete set null,
  topic text,
  open_at timestamptz not null,
  pre_due_at timestamptz not null,
  post_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (group_id, month)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  month int not null,
  form_type text not null check (form_type in ('pre','presentation','post')),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted')),
  submitted_at timestamptz,
  is_late boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_id, profile_id, form_type)
);
create index submissions_profile_month on public.submissions (profile_id, month);
create index submissions_company on public.submissions (company_id);

create table public.deadline_overrides (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  form_type text not null check (form_type in ('pre','presentation','post')),
  new_due_at timestamptz not null,
  reason text not null,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (session_id, profile_id, form_type)
);

create table public.attendance (
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  status text not null check (status in ('present','absent')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create table public.email_logs (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  type text not null,
  session_id uuid references public.sessions(id) on delete set null,
  to_email text,
  dedupe_key text unique,
  result text not null,          -- sent / failed / skipped
  error text,
  sent_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  action text not null,
  target text,
  reason text,
  created_at timestamptz not null default now()
);

-- 화면 오류 기록 (참가자 화면에서 난 오류를 관리자가 확인)
create table public.client_errors (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  message text not null check (char_length(message) <= 2000),
  detail text check (char_length(detail) <= 8000),
  url text check (char_length(url) <= 500),
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

create table public.login_attempts (
  email text primary key,
  fail_count int not null default 0,
  locked_until timestamptz
);

-- ---------------------------------------------------------------------
-- 2. 권한 판정 함수 (security definer: RLS 재귀 방지)
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid() and is_active), false)
$$;

create or replace function public.is_admin_of(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'super_admin' or (role = 'company_admin' and company_id = cid)
    from profiles where id = auth.uid() and is_active), false)
$$;

create or replace function public.my_group() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from group_members where profile_id = auth.uid()
$$;

create or replace function public.shares_group(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.profile_id = auth.uid() and b.profile_id = pid)
$$;

-- ---------------------------------------------------------------------
-- 3. 트리거
-- ---------------------------------------------------------------------
-- 3-1. profiles: 권한 상승·소속 변경 차단
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
      raise exception '본인은 알림 메일 주소만 변경할 수 있습니다.';
    end if;
    return new;
  end if;
  raise exception '권한이 없습니다.';
end $$;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- 3-2. sessions: company_id를 그룹에서 채움
create or replace function public.sessions_fill() returns trigger
language plpgsql as $$
begin
  select company_id into new.company_id from public.study_groups where id = new.group_id;
  return new;
end $$;
create trigger trg_sessions_fill before insert or update on public.sessions
  for each row execute function public.sessions_fill();

-- 3-3. submissions: 마감·잠금·지연 판정 (화면 조작으로 우회 불가)
create or replace function public.effective_due(p_session uuid, p_profile uuid, p_form text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce(
    (select new_due_at from deadline_overrides
      where session_id = p_session and profile_id = p_profile and form_type = p_form),
    (select case when p_form = 'post' then post_due_at else pre_due_at end
       from sessions where id = p_session))
$$;

-- 3-3a. 제출 내용 검증 (화면과 같은 규칙: 공백을 하나로 줄인 글자 수 기준)
create or replace function public.content_len(t text) returns int
language sql immutable as $$
  select char_length(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.validate_submission(p_form text, c jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare st app_settings; k text; n int; q int;
begin
  select * into st from app_settings where id = 1;
  if pg_column_size(c) > 60000 then return '내용이 너무 깁니다.'; end if;
  if p_form = 'pre' then
    n := content_len(c->>'summary');
    if n < st.summary_min or n > st.summary_max then
      return format('핵심 요약은 %s~%s자로 작성해 주세요. (현재 %s자)', st.summary_min, st.summary_max, n);
    end if;
    select count(*) into q from jsonb_array_elements(coalesce(c->'quotes', '[]'::jsonb)) e
      where content_len(e->>'text') > 0;
    if q < 3 then return '인용구절 3개를 모두 입력해 주세요.'; end if;
  else
    foreach k in array case when p_form = 'presentation'
      then array['feeling','implication','application','perspective'] else array['topic','insight','expectation'] end loop
      if content_len(c->>k) < st.field_min then
        return format('모든 항목을 %s자 이상 작성해 주세요.', st.field_min);
      end if;
    end loop;
  end if;
  return null;
end $$;

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
create trigger trg_submissions_guard before insert or update on public.submissions
  for each row execute function public.submissions_guard();

-- 3-4. overrides / attendance: company_id 채움 + 감사 로그
create or replace function public.fill_company_from_session() returns trigger
language plpgsql as $$
begin
  select company_id into new.company_id from public.sessions where id = new.session_id;
  return new;
end $$;
create trigger trg_overrides_fill before insert or update on public.deadline_overrides
  for each row execute function public.fill_company_from_session();
create trigger trg_attendance_fill before insert or update on public.attendance
  for each row execute function public.fill_company_from_session();

create or replace function public.overrides_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select name || '(' || emp_no || ')' into who from profiles where id = new.profile_id;
  insert into audit_logs (actor_id, company_id, action, target, reason)
  values (auth.uid(), new.company_id, '기한 연장/잠금 해제',
          who || ' · ' || new.form_type || ' → ' || to_char(new.new_due_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
          new.reason);
  return new;
end $$;
create trigger trg_overrides_audit after insert or update on public.deadline_overrides
  for each row execute function public.overrides_audit();

-- ---------------------------------------------------------------------
-- 4. RPC
-- ---------------------------------------------------------------------
-- 4-1. 로그인 잠금 (5회 실패 → 10분)
create or replace function public.login_guard(p_email text) returns timestamptz
language sql security definer set search_path = public as $$
  select locked_until from login_attempts where email = lower(p_email) and locked_until > now()
$$;

create or replace function public.login_failed(p_email text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare r login_attempts;
begin
  insert into login_attempts (email, fail_count) values (lower(p_email), 1)
  on conflict (email) do update
    set fail_count = case when login_attempts.locked_until is not null and login_attempts.locked_until <= now()
                          then 1 else login_attempts.fail_count + 1 end,
        locked_until = case when login_attempts.locked_until is not null and login_attempts.locked_until <= now()
                            then null else login_attempts.locked_until end
  returning * into r;
  if r.fail_count >= 5 then
    update login_attempts set locked_until = now() + interval '10 minutes', fail_count = 0
     where email = r.email returning locked_until into r.locked_until;
  end if;
  return r.locked_until;
end $$;

create or replace function public.login_ok() returns void
language sql security definer set search_path = public as $$
  delete from login_attempts
   where email = (select lower(email) from auth.users where id = auth.uid());
  update profiles set last_seen_at = now() where id = auth.uid();
$$;

-- 앱을 열 때 하루 1회 최근 접속 갱신
create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now()
   where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '12 hours');
$$;

-- 개인정보 수집·이용 확인
create or replace function public.agree_privacy() returns void
language sql security definer set search_path = public as $$
  update profiles set privacy_agreed_at = now() where id = auth.uid() and privacy_agreed_at is null;
$$;

-- 로그인 전에도 보이는 안내 정보 (문의처·보관 기간)
create or replace function public.public_info() returns table (contact_email text, contact_phone text, privacy_officer text, retention_text text, year int)
language sql stable security definer set search_path = public as $$
  select contact_email, contact_phone, privacy_officer, retention_text, year from app_settings where id = 1
$$;

-- 연도 데이터 일괄 파기 (총괄 관리자) — 그룹·회차·제출물·출석·연장 기록이 함께 삭제됩니다
create or replace function public.purge_year(p_year int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_super() then raise exception '총괄 관리자만 실행할 수 있습니다.'; end if;
  select count(*) into n from submissions s join sessions x on x.id = s.session_id
    join study_groups g on g.id = x.group_id where g.year = p_year;
  delete from study_groups where year = p_year;
  insert into audit_logs (actor_id, action, target) values (auth.uid(), '연도 데이터 파기', p_year || '년 그룹·회차 및 제출물 ' || n || '건');
  return n;
end $$;

-- 4-2. Facilitator 발제 주제 등록
create or replace function public.set_session_topic(p_session uuid, p_topic text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update sessions set topic = p_topic
   where id = p_session
     and (facilitator_id = auth.uid() or public.is_admin_of(company_id));
  if not found then raise exception '발제 주제를 등록할 권한이 없습니다.'; end if;
end $$;

-- 4-3. 로그인 화면용 계열사 목록 (비로그인 조회 허용)
create or replace function public.login_companies() returns table (code text, name text)
language sql stable security definer set search_path = public as $$
  select code, name from companies where is_active order by sort_order, name
$$;

-- 4-4. 최초 설치 여부 (총괄 관리자가 한 명도 없으면 초기 설정 화면 노출)
create or replace function public.needs_setup() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where role = 'super_admin')
$$;

grant execute on function public.login_guard(text), public.login_failed(text), public.login_companies(), public.needs_setup() to anon, authenticated;
grant execute on function public.login_ok(), public.set_session_topic(uuid, text), public.touch_seen(), public.agree_privacy(), public.purge_year(int) to authenticated;
grant execute on function public.public_info() to anon, authenticated;
revoke execute on function public.validate_submission(text, jsonb) from anon;

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.companies          enable row level security;
alter table public.profiles           enable row level security;
alter table public.books              enable row level security;
alter table public.app_settings       enable row level security;
alter table public.study_groups       enable row level security;
alter table public.group_members      enable row level security;
alter table public.curricula          enable row level security;
alter table public.sessions           enable row level security;
alter table public.submissions        enable row level security;
alter table public.deadline_overrides enable row level security;
alter table public.attendance         enable row level security;
alter table public.email_logs         enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.login_attempts     enable row level security;
alter table public.client_errors      enable row level security;  -- 정책 없음 = RPC로만 접근

-- companies
create policy companies_read  on public.companies for select to authenticated using (public.my_company() is not null);
create policy companies_write on public.companies for all to authenticated
  using (public.is_super()) with check (public.is_super());
create policy companies_admin_update on public.companies for update to authenticated
  using (public.is_admin_of(id)) with check (public.is_admin_of(id));

-- profiles
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin_of(company_id) or public.shares_group(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin_of(company_id))
  with check (id = auth.uid() or public.is_admin_of(company_id));
-- insert/delete는 서버 함수(service role)만

-- books / settings
create policy books_read  on public.books for select to authenticated using (public.my_company() is not null);
create policy books_write on public.books for all to authenticated
  using (public.is_super()) with check (public.is_super());
create policy settings_read  on public.app_settings for select to authenticated using (public.my_company() is not null);
create policy settings_write on public.app_settings for update to authenticated
  using (public.is_super()) with check (public.is_super());

-- groups / members / curricula / sessions : 같은 회사 조회, 관리자 쓰기
create policy groups_read  on public.study_groups for select to authenticated
  using (company_id = public.my_company() or public.is_admin_of(company_id));
create policy groups_write on public.study_groups for all to authenticated
  using (public.is_admin_of(company_id)) with check (public.is_admin_of(company_id));

create policy gm_read on public.group_members for select to authenticated using (
  exists (select 1 from study_groups g where g.id = group_id
          and (g.company_id = public.my_company() or public.is_admin_of(g.company_id))));
create policy gm_write on public.group_members for all to authenticated
  using (exists (select 1 from study_groups g where g.id = group_id and public.is_admin_of(g.company_id)))
  with check (exists (select 1 from study_groups g where g.id = group_id and public.is_admin_of(g.company_id)));

create policy cur_read  on public.curricula for select to authenticated
  using (company_id = public.my_company() or public.is_admin_of(company_id));
create policy cur_write on public.curricula for all to authenticated
  using (public.is_admin_of(company_id)) with check (public.is_admin_of(company_id));

create policy sessions_read  on public.sessions for select to authenticated
  using (company_id = public.my_company() or public.is_admin_of(company_id));
create policy sessions_write on public.sessions for all to authenticated
  using (public.is_admin_of(company_id))
  with check (exists (select 1 from study_groups g where g.id = group_id and public.is_admin_of(g.company_id)));

-- submissions
create policy subs_read on public.submissions for select to authenticated using (
  profile_id = auth.uid()
  or public.is_admin_of(company_id)
  or (form_type = 'presentation' and status = 'submitted'
      and exists (select 1 from sessions s where s.id = session_id and s.group_id = public.my_group())));
create policy subs_insert on public.submissions for insert to authenticated
  with check (profile_id = auth.uid());
create policy subs_update on public.submissions for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- overrides
create policy ovr_read on public.deadline_overrides for select to authenticated
  using (profile_id = auth.uid() or public.is_admin_of(company_id));
create policy ovr_write on public.deadline_overrides for all to authenticated
  using (public.is_admin_of(company_id))
  with check (exists (select 1 from sessions s where s.id = session_id and public.is_admin_of(s.company_id)));

-- attendance
create policy att_read on public.attendance for select to authenticated
  using (profile_id = auth.uid() or public.is_admin_of(company_id));
create policy att_write on public.attendance for all to authenticated
  using (public.is_admin_of(company_id))
  with check (exists (select 1 from sessions s where s.id = session_id and public.is_admin_of(s.company_id)));

-- logs
create policy email_logs_read on public.email_logs for select to authenticated
  using (public.is_admin_of(company_id));
create policy audit_read on public.audit_logs for select to authenticated
  using (public.is_super() or public.is_admin_of(company_id));
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid() and (public.is_super() or public.is_admin_of(company_id)));

-- client_errors: 본인 명의로만 기록, 총괄 관리자만 조회
create policy cerr_insert on public.client_errors for insert to authenticated
  with check (profile_id = auth.uid());
create policy cerr_read on public.client_errors for select to authenticated using (public.is_super());
