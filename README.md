# '27 리더십 2년차 독서교육 플랫폼

상상인그룹 인재경영실 · 「'27년도 리더십 2년차 교육(안)」(2026.10.13) 운영용 웹앱 (PC·모바일 공용)

- 화면: React + Vite + TypeScript, Pretendard, 디자인 토큰은 [Winning Basic!](https://goodwon89.github.io/winning-basic/)과 동일
- 데이터·인증·메일: Supabase Pro (PostgreSQL + Auth + Edge Functions + pg_cron)
- 배포: GitHub Pages (main 브랜치 push 시 자동 배포)
- Supabase 값이 없으면 **데모 모드**로 동작 (브라우저 저장소 사용, 9개사 85명 예시 데이터)

---

## 1. 설치 순서 (최초 1회, 약 40분)

### 1-1. GitHub 저장소
1. GitHub에서 새 저장소 `leadership-reading` 생성 (무료 계정은 **Public**이어야 Pages 사용 가능)
2. 이 폴더 전체를 올립니다.
   ```bash
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/goodwon89/leadership-reading.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Source: GitHub Actions** 선택
4. 이 시점에 배포되는 사이트는 데모 모드입니다. `https://goodwon89.github.io/leadership-reading/`

### 1-2. Supabase 프로젝트
1. supabase.com에서 새 프로젝트 생성 — **Region: Northeast Asia (Seoul)**, 요금제 **Pro**
2. **SQL Editor**에서 순서대로 실행
   - `supabase/migrations/0001_schema.sql` (테이블·권한·트리거)
   - `supabase/seed.sql` (운영 설정 + 도서 12권)
3. **Project Settings → API**에서 `Project URL`, `anon public key` 복사
4. **Authentication → Sign In / Providers**에서 **Allow new users to sign up 끄기** (계정은 관리자만 만듭니다)
5. **Database → Backups**에서 매일 자동 백업이 쌓이는지 확인 (Pro 요금제 포함)

### 1-3. 서버 함수 배포 (계정 생성·비밀번호·메일)
GitHub 저장소 **Settings → Secrets and variables → Actions**에 등록:

| 이름 | 값 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens에서 발급 |
| `SUPABASE_PROJECT_REF` | 프로젝트 URL `https://<여기>.supabase.co`의 앞부분 |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `VITE_AUTH_EMAIL_DOMAIN` | `reading.sangsangin.local` (아래 함수 설정과 같은 값) |

그다음 **Actions → Deploy Supabase Functions → Run workflow** 실행.

Supabase **Edge Functions → Secrets(환경변수)**에 등록:

| 이름 | 값 |
|---|---|
| `AUTH_EMAIL_DOMAIN` | `reading.sangsangin.local` |
| `RESEND_API_KEY` | Resend 가입 후 발급 (도메인 인증 필요). 회사 SMTP를 쓰려면 notify 함수의 `send()`만 교체 |
| `MAIL_FROM` | `인재경영실 <hr@회사도메인>` |
| `CRON_SECRET` | 임의의 긴 문자열 (예: 32자 랜덤) |
| `BOOTSTRAP_CODE` | 초기 설정 화면에서 입력할 설치 코드 (본인만 아는 문자열). 이 값을 아는 사람만 총괄 관리자를 만들 수 있습니다 |

### 1-4. 매일 09:00 메일 알림
1. **Database → Extensions**에서 `pg_cron`, `pg_net` 활성화
2. `supabase/migrations/0002_cron.sql`의 `<PROJECT_REF>`, `<CRON_SECRET>`을 바꿔 SQL Editor에서 실행

### 1-5. 실제 모드로 재배포
**Actions → Deploy to GitHub Pages → Run workflow** (또는 아무 커밋 push).
사이트에 접속하면 **초기 설정 화면**이 나옵니다 → 설치 코드(`BOOTSTRAP_CODE`) 입력 → 인재경영실 계정(총괄 관리자) 등록 → 사번으로 로그인 → 비밀번호 변경 → 개인정보 수집·이용 확인.
**배포 직후 바로 등록하세요.** GitHub 저장소 Settings → Pages에서 **Enforce HTTPS**가 켜져 있는지도 확인합니다.

### 1-6. 운영 준비 (총괄 관리자)
1. **설정 → 운영 설정**: 플랫폼 주소(`https://goodwon89.github.io/leadership-reading/`), 최종 마감일, **문의처·개인정보 보호 담당·보관 기간** 입력 (푸터와 개인정보 안내에 표시. 안내문 최종 문구는 인사·법무 검토)
2. **설정 → 계열사·관리자**: 9개 계열사 추가 (코드는 로그인에 쓰이므로 영문·숫자, 변경 불가)
3. 각 사 HR 담당자를 **계열사별 관리 → 대상자**에서 등록(교육 대상자 체크 해제) → **설정 → 관리자 지정**
4. 각 사 관리자: 대상자 엑셀 일괄 등록 → 토론 그룹 편성 → 연간 도서 편성 → 회차 일괄 생성 → 계정 안내 메일

---

## 2. 역할과 화면

| 역할 | 주요 화면 |
|---|---|
| 사용자(참가자) | 홈 · 이번 회차(사전학습/발표자료/과제 작성, 그룹 발표자료) · 내 서재 · 내 정보 |
| 각 사 관리자 | 대시보드 · 대상자 · 토론 그룹 · 도서 편성 · 회차·출석 · 제출 현황(기한 연장) · 내보내기 |
| 총괄 관리자 | 그룹 대시보드 · 인사이트 · 분기 보고 · 계열사별 관리(9개사 전환) · 설정(운영/계열사·관리자/도서/감사 로그/메일 기록) |

참가자 겸 관리자는 상단 **관리자 모드 / 참가자 모드** 버튼으로 전환합니다.

## 2-1. 출시 점검 반영 (2026-10-20)

- 첫 로그인: 비밀번호 변경 → 개인정보 수집·이용 확인(동의 일시 저장) 후 이용
- 화면 오류는 빈 화면 대신 안내 화면을 보여 주고, **설정 → 오류 기록**에 자동으로 남습니다
- 대상자 목록에 **최근 접속일**과 '한 번도 접속 안 한 사람' 필터
- **설정 → 데이터 파기**: 보관 기간이 지난 연도의 그룹·회차·제출물 일괄 삭제(확인 문구 입력)
- 검색 노출 차단(noindex), 링크 공유 미리보기(og.png), 파비콘·홈 화면 아이콘, 잘못된 주소용 404 페이지
- 제출 내용 규칙(요약 글자 수·인용 3개·항목별 최소 글자)을 DB에서도 검사
- 휴대폰 입력칸 16px(아이폰 자동 확대 방지), 관리자 버튼 터치 영역 확대, 엑셀 기능은 필요할 때만 불러옴

## 3. 운영 규칙 (사양서 v0.1 기준 구현값)

- 로그인: 계열사 선택 + 사번 + 비밀번호. 최초 비밀번호 = 사번, 첫 로그인 시 변경 강제(영문·숫자 8자 이상, 사번과 다름)
- 5회 연속 실패 시 10분 잠금 → 관리자 비밀번호 초기화로 즉시 해제
- 회차 일정: 오픈 D-14 09:00, 사전학습·발표자료 마감 D-1 23:59, 과제 마감 D+7 23:59 (설정에서 변경)
- 마감 후 미제출 → 최종 마감일까지 **지연 제출** 허용(수료 인정). 제출 후 마감 지나면 잠김 → 관리자 기한 연장으로 해제
- 수료: 본부장·팀장급 12회 × 3양식 = 36건 전부 제출. 대표급은 선택 입력, 수료 판정 제외
- 공개 범위: 발표자료만 같은 그룹 공개(본인 발표자료 제출 후 열람). 사전학습·과제는 본인·관리자만
- 마감·잠금·지연 판정은 DB 트리거에서 처리하므로 화면 조작으로 우회할 수 없습니다.

## 4. 보안 메모

- 화면 코드는 공개 URL이지만 데이터는 로그인 + RLS(행 단위 권한)로 보호됩니다. 각 사 관리자는 자기 계열사 데이터만 조회됩니다.
- 브라우저에는 anon key만 들어갑니다. service role key는 Edge Function 안에만 있습니다.
- Supabase Auth는 이메일을 계정 키로 쓰므로 내부적으로 `{계열사코드}_{사번}@AUTH_EMAIL_DOMAIN` 가상 주소를 사용합니다. 실제 알림 메일은 `notify_email`로 보냅니다.
- 짧은 사번도 최초 비밀번호로 쓸 수 있도록 Auth에 저장할 때 내부 접두어(`rd!`)를 붙입니다. 사용자에게는 보이지 않습니다.

## 5. 사양서 대비 구현 메모

- `sessions.book_id` 대신 연간 편성(curricula)에서 도서를 찾습니다 → 편성을 바꾸면 아직 열리지 않은 회차에 바로 반영됩니다.
- 그룹 이동 시 지난 회차 기록은 원래 그룹 회차에 남고, 수료 판정은 월 기준(1~12월 × 3양식)으로 합산합니다.
- 계정 생성·초기화·비활성·역할 변경·계열사 이동은 모두 감사 로그에 남습니다.

## 6. 개발

```bash
npm install
npm run dev            # .env 없으면 데모 모드
npm run build          # 타입 검사 + 빌드 (dist)
npm run build:single   # 단일 HTML 데모 (dist-single)
```

폴더 구조

```
src/
  lib/        types · rules(양식/편성/일정 규칙) · metrics(수료·지표 계산) · data · reports · excel · demo/
  state/      auth(로그인·모드·계열사 범위) · mine(참가자 데이터)
  pages/      auth · user · admin · hq
supabase/
  migrations/ 0001_schema.sql · 0002_cron.sql
  functions/  admin-users · change-password · notify
.github/workflows/  deploy.yml(Pages) · deploy-functions.yml(Edge Functions)
```
