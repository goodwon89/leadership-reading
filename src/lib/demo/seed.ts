// 데모 데이터: 9개 계열사(가칭 A~I사), 85명, 회차 일정은 '오늘' 기준으로 1~3월 종료·4월 진행 중이 되도록 배치
import { authEmail, authPassword } from "../account";
import { defaultDates, SAMPLES } from "../rules";

type Row = Record<string, any>;
export interface DemoStore {
  tables: Record<string, Row[]>;
  auth: { users: { id: string; email: string; password: string }[]; session: any };
  login: Record<string, { fail: number; locked_until: number }>;
}

export const BOOKS = [
  { id: 1, no: 1, category: "경영", title: "좋은 기업을 넘어 위대한 기업으로", author: "짐 콜린스", summary: "위대한 기업의 지속 성장을 이끄는 핵심 원칙 제시 (Good to Great)", recommended_by: "그룹 CEO 강조도서" },
  { id: 2, no: 2, category: "경영", title: "좋은 리더를 넘어 위대한 리더로", author: "짐 콜린스", summary: "위대한 성과를 이끄는 리더의 자질과 실천 방안 제시", recommended_by: "그룹 CEO 강조도서" },
  { id: 3, no: 3, category: "경영", title: "실리콘밸리의 팀장들", author: "킴 스콧", summary: "공감과 직언의 균형을 통한 효과적인 리더십 제시", recommended_by: "그룹 CEO 강조도서" },
  { id: 4, no: 4, category: "경영", title: "일의 격", author: "신수정", summary: "성장하는 나, 성공하는 조직, 성숙한 삶", recommended_by: "상상인(모회사) 대표 추천" },
  { id: 5, no: 5, category: "경영", title: "무엇이 성과를 이끄는가", author: "닐 도쉬, 린지 맥그리거", summary: "내재적 동기를 기반으로 한 고성과 조직문화", recommended_by: null },
  { id: 6, no: 6, category: "경영", title: "High Output Management", author: "앤드루 S 그로브", summary: "탁월한 성과를 만드는 관리자의 태도와 원칙", recommended_by: null },
  { id: 7, no: 7, category: "경영", title: "히트 리프레시", author: "사티아 나델라", summary: "MS에서 성장하고 CEO까지 오른 사티아 나델라의 저서. 공감과 성장 마인드셋을 바탕으로 한 조직문화 혁신", recommended_by: null },
  { id: 8, no: 8, category: "인문", title: "내가 틀릴 수도 있습니다", author: "비욘 나티코 린데블라드", summary: "자신의 한계를 인정하는 겸손과 성찰", recommended_by: "그룹 CEO 강조도서" },
  { id: 9, no: 9, category: "인문", title: "난중일기", author: "이순신", summary: "국난 속 책임감과 리더의 헌신적 자세 제시", recommended_by: "그룹 CEO 강조도서" },
  { id: 10, no: 10, category: "인문", title: "죽음의 수용소에서", author: "빅터 프랭클", summary: "삶의 의미 발견을 통한 인간의 회복탄력성과 희망의 가치 제시", recommended_by: "메디카코리아 대표 추천" },
  { id: 11, no: 11, category: "인문", title: "명상록", author: "마르쿠스 아우렐리우스", summary: "전쟁터에서 제국을 이끈 로마 황제의 자기 경계 일기. 감정 통제와 자기 성찰을 통한 올바른 리더십의 중요성 강조", recommended_by: "엠아이텍 대표 추천" },
  { id: 12, no: 12, category: "인문", title: "동물농장", author: "조지 오웰", summary: "권력 집중과 정보 독점이 초래하는 조직의 부패 메커니즘을 우화 형식으로 제시", recommended_by: "엠아이텍 대표 추천" },
].map((b) => ({ ...b, cover_url: `covers/book-${String(b.id).padStart(2, "0")}.jpg` }));

// 데모용 작성 예시 문장 (원문 인용이 아닌 요지 정리)
const IDEAS: Record<number, [string, string[]]> = {
  1: ["좋은 기업이 위대한 기업으로 도약하려면 규율 있는 사람, 규율 있는 사고, 규율 있는 행동이 맞물려야 한다는 점을 장기 데이터로 보여 준다.", ["적합한 사람을 먼저 태우고 방향은 그다음에 정한다는 원칙", "냉혹한 현실을 직시하면서도 끝내 이긴다는 믿음을 함께 지키는 태도", "잘할 수 있고, 열정이 있고, 경제 엔진을 움직이는 일의 교집합"]],
  2: ["위대한 리더는 개인의 명성보다 조직의 성과를 앞세우며, 겸손과 단호한 의지를 함께 갖춘 사람이라는 점을 강조한다.", ["성공은 창밖을 보고 공을 돌리고, 실패는 거울을 보며 책임지는 리더", "개인적 겸손과 직업적 의지의 결합", "후계자가 더 크게 성공하도록 준비시키는 리더십"]],
  3: ["팀장은 개인적으로 깊이 관심을 가지면서도 직접적으로 피드백할 때 신뢰를 얻는다는 '완전한 솔직함'의 틀을 제시한다.", ["상대를 아끼기 때문에 불편한 말을 할 수 있다는 관점", "칭찬은 구체적으로, 지적은 빠르고 사적으로", "피드백을 먼저 요청하는 리더가 피드백 문화를 만든다"]],
  4: ["일의 격은 기술보다 태도와 관점에서 결정되며, 개인의 성장과 조직의 성공, 성숙한 삶이 연결되어 있다는 메시지를 전한다.", ["일의 의미를 스스로 정의할 때 일의 격이 올라간다", "작은 약속을 지키는 습관이 신뢰 자본을 만든다", "리더는 답을 주는 사람이 아니라 좋은 질문을 던지는 사람"]],
  5: ["성과의 동력은 보상과 압박이 아니라 일의 즐거움, 의미, 성장이라는 내재적 동기에 있으며 이를 조직문화로 설계할 수 있다고 말한다.", ["사람이 일하는 이유가 곧 성과의 질을 결정한다", "정서적 압박과 경제적 압박은 총동기를 떨어뜨린다", "역할 설계와 피드백 구조로 동기를 키울 수 있다"]],
  6: ["관리자의 산출물은 자기 조직과 영향을 미치는 주변 조직의 산출물의 합이며, 레버리지가 높은 활동에 시간을 써야 한다고 설명한다.", ["관리자의 성과는 팀 전체의 산출물로 측정된다", "회의는 의사결정과 정보 공유를 위한 생산 공정이다", "일대일 면담은 가장 레버리지가 높은 관리 활동 중 하나"]],
  7: ["조직의 영혼을 다시 깨우는 혁신은 공감과 성장 마인드셋에서 출발하며, 리더가 먼저 배우는 문화를 만들어야 한다고 이야기한다.", ["모든 것을 아는 조직보다 모든 것을 배우는 조직", "고객과 동료에 대한 공감이 혁신의 출발점", "문화는 선언이 아니라 매일의 선택으로 바뀐다"]],
  8: ["확신을 내려놓고 '내가 틀릴 수도 있다'고 말할 수 있을 때 관계와 판단이 더 단단해진다는 성찰을 담고 있다.", ["모든 생각을 믿을 필요는 없다는 깨달음", "통제할 수 없는 것을 내려놓는 용기", "겸손은 약함이 아니라 배움의 문을 여는 태도"]],
  9: ["극한의 위기 속에서도 기록하고 대비하며 책임을 다한 리더의 일상을 통해 헌신과 준비의 의미를 보여 준다.", ["위기일수록 원칙과 준비가 리더의 무기", "부하의 고통을 함께 짊어지는 책임감", "매일의 기록이 판단의 근거가 된다"]],
  10: ["어떤 상황에서도 태도를 선택할 자유가 남아 있으며, 삶의 의미를 찾는 힘이 회복탄력성의 근원이라는 점을 전한다.", ["자극과 반응 사이에 선택의 공간이 있다", "의미를 가진 사람은 어떤 고난도 견딘다", "고통 속에서도 태도를 선택할 자유"]],
  11: ["외부 사건이 아니라 그에 대한 해석이 마음을 흔든다는 관점으로, 감정을 다스리고 자신을 성찰하는 리더의 태도를 말한다.", ["바꿀 수 있는 것과 없는 것을 구분하라", "오늘 해야 할 일에 온전히 집중하라", "타인의 잘못보다 나의 반응을 먼저 살펴라"]],
  12: ["권력이 소수에게 집중되고 정보가 독점될 때 이상이 어떻게 변질되는지를 우화로 보여 주며 조직의 견제 장치를 생각하게 한다.", ["원칙이 조금씩 고쳐 쓰일 때 조직은 무너진다", "정보 독점은 권력 집중의 출발점", "침묵하는 다수가 부패를 완성한다"]],
};
const PAD = " 특히 리더로서 매일 내리는 작은 결정들이 결국 조직의 문화를 만든다는 점을 다시 생각하게 되었다. 책의 사례를 우리 조직에 비추어 보면, 원칙을 말로 정하는 것보다 구성원이 체감하는 행동으로 보여 주는 일이 더 중요하다. 다음 회의부터 질문을 먼저 던지고 끝까지 듣는 습관을 실천해 보려 한다. 작은 실천이 쌓여 팀의 신뢰가 된다는 점을 기억하겠다.";
const FEEL = ["읽는 내내 지금 우리 팀의 모습이 겹쳐 보였다. 성과에 쫓겨 사람을 놓치고 있지는 않은지 돌아보게 되었다.", "익숙하다고 생각했던 리더십 원칙을 다른 시각으로 다시 보게 되었고, 그동안 내가 당연하게 여긴 방식에 질문을 던지게 되었다.", "저자의 경험이 구체적이어서 공감이 컸다. 특히 위기 상황에서 리더가 보여야 할 태도에 대해 오래 생각했다."];
const IMPL = ["리더의 말과 행동이 일치할 때 신뢰가 쌓이고, 그 신뢰가 실행 속도를 결정한다는 점이 가장 큰 시사점이다.", "구성원에게 답을 주기보다 스스로 답을 찾게 하는 질문이 조직의 역량을 키운다는 점을 확인했다.", "단기 성과와 장기 역량 사이의 균형을 리더가 의식적으로 관리해야 한다는 점이 우리 조직에 시사하는 바가 크다."];
const APPL = ["격주로 팀원과 30분 일대일 면담을 정례화하고, 면담의 절반은 팀원이 주제를 정하도록 운영하겠다.", "주간 회의 마지막 10분을 '이번 주에 배운 것' 공유 시간으로 바꿔 학습하는 팀 문화를 만들겠다.", "의사결정 전에 반대 의견을 한 가지 이상 반드시 듣는 원칙을 팀 운영 규칙으로 정하겠다."];
const PERS = ["좋은 직언과 상처 주는 말의 경계는 어디인가? 각자의 경험을 듣고 싶다.", "우리 조직에서 '적합한 사람'의 기준은 무엇이어야 하는가?", "성과 압박이 큰 상황에서 구성원의 내재적 동기를 어떻게 지킬 수 있을까?"];
const TOPIC = ["리더의 피드백이 신뢰로 이어지는 조건", "위기 상황에서 리더의 책임과 권한 위임의 균형", "성과와 성장의 균형을 잡는 팀 운영 방식"];
const INSI = ["같은 원칙도 조직의 상황에 따라 다르게 적용된다는 점을 다른 계열사 리더들의 사례로 확인했다. 정답보다 맥락을 읽는 힘이 중요하다.", "구성원이 말하지 않는 것은 문제가 없어서가 아니라 말할 통로가 없어서일 수 있다는 의견이 인상 깊었다.", "토론을 통해 리더 혼자 해결하려는 습관을 내려놓고 팀의 집단 지성을 활용하는 방법을 다시 생각하게 되었다."];
const EXPE = ["팀원들과 이번 토론 내용을 공유하고, 다음 분기 팀 운영 원칙에 한 가지 이상 반영하는 것을 목표로 하겠다.", "그룹 차원에서 리더 간 경험을 꾸준히 나누는 자리가 이어지기를 기대한다. 다음 회차까지 실천 결과를 정리해 오겠다.", "개인적으로는 감정적인 반응을 줄이고, 조직 차원에서는 솔직한 피드백이 오가는 회의 문화를 만들고 싶다."];

const SUR = "김이박최정강조윤장임한오서신권황안송류홍".split("");
const GIV = ["민준", "서연", "도윤", "지우", "현우", "수빈", "지훈", "예린", "성민", "하은", "재원", "유진", "태호", "나연", "승현", "다은", "정우", "소희", "동현", "미경", "상훈", "혜진", "준호", "은지", "영수"];

function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const id = (p: string, n: number) => `${p}${String(n).padStart(12, "0")}`.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, "$1-$2-$3-$4-$5");

export function buildSeed(): DemoStore {
  const r = rng(20270101);
  const now = Date.now();
  const companies: Row[] = "ABCDEFGHI".split("").map((c, i) => ({
    id: id("c0000000", i + 1), code: c, name: `${c}사`, sort_order: i + 1, per_group_curriculum: false, is_active: true, created_at: new Date().toISOString(),
  }));
  const sizes = [12, 11, 10, 10, 9, 9, 8, 8, 8];
  const settings = { id: 1, year: 2027, open_offset_days: 14, pre_due_offset_days: 1, post_due_offset_days: 7, final_deadline: "", summary_min: 250, summary_max: 400, field_min: 50, mail_enabled: true, app_url: "https://goodwon89.github.io/leadership-reading/", updated_at: new Date().toISOString(),
    contact_email: "kwjang@sangsanginworld.co.kr", contact_phone: null, privacy_officer: "인재경영실 장근원 과장", retention_text: "교육 종료 후 [ ]년" };
  const profiles: Row[] = [], users: DemoStore["auth"]["users"] = [], groups: Row[] = [], members: Row[] = [], curricula: Row[] = [], sessions: Row[] = [];
  let n = 0;
  companies.forEach((c, ci) => {
    const gCount = sizes[ci] >= 10 ? 2 : 1;
    const gs = Array.from({ length: gCount }, (_, gi) => ({ id: id("90000000", ci * 10 + gi + 1), company_id: c.id, name: `${gi + 1}그룹`, year: 2027, sort_order: gi, created_at: new Date().toISOString() }));
    groups.push(...gs);
    for (let k = 0; k < sizes[ci]; k++) {
      n++;
      const emp = String(1000 + ci * 100 + k + 1);
      const rank = k === sizes[ci] - 1 ? "대표급" : k <= 2 ? "본부장급" : "팀장급";
      const pid = id("b0000000", n);
      profiles.push({
        id: pid, company_id: c.id, emp_no: emp, name: SUR[(n * 7) % SUR.length] + GIV[(n * 11) % GIV.length], rank_level: rank,
        position: rank === "대표급" ? "대표이사" : rank === "본부장급" ? "본부장" : "팀장", department: ["경영지원", "영업", "전략기획", "R&D", "재무", "IT"][(n * 3) % 6] + (rank === "팀장급" ? "팀" : rank === "본부장급" ? "본부" : ""),
        notify_email: `user${emp}@example.com`, role: "user", is_participant: true, must_change_password: !(emp === "1001"), is_active: true, created_at: new Date().toISOString(),
        privacy_agreed_at: emp === "1001" || k > 1 ? new Date(now - 60 * 86400000).toISOString() : null,
        last_seen_at: k % 7 === 6 ? null : new Date(now - ((n * 13) % 20) * 86400000).toISOString(),
      });
      users.push({ id: pid, email: authEmail(c.code, emp), password: authPassword(emp) });
      members.push({ profile_id: pid, group_id: gs[k % gCount].id, assigned_at: new Date().toISOString() });
    }
    // 계열사 HR 관리자(참가자 아님) — A사는 참가자 겸 관리자 예시
    const hrId = id("a0000000", ci + 1), hrEmp = String(1000 + ci * 100 + 90);
    profiles.push({ id: hrId, company_id: c.id, emp_no: hrEmp, name: `${c.name} HR담당`, rank_level: "팀장급", position: "HR 담당", department: "인사팀", notify_email: `hr${c.code.toLowerCase()}@example.com`, role: "company_admin", is_participant: false, must_change_password: false, is_active: true, privacy_agreed_at: new Date(now - 90 * 86400000).toISOString(), last_seen_at: new Date(now - 86400000).toISOString() });
    users.push({ id: hrId, email: authEmail(c.code, hrEmp), password: authPassword(hrEmp) });
    // 연간 도서 편성: Sample A/B/C 순환
    SAMPLES[ci % 3].order.forEach((bookId, i) => curricula.push({ id: id("d0000000", ci * 20 + i + 1), company_id: c.id, group_id: null, month: i + 1, book_id: bookId }));
    // 회차: 오늘 기준 4월 회차가 진행 중 (토론일 = 오늘+5일), 매 회차 28일 간격
    gs.forEach((g, gi) => {
      const groupMembers = members.filter((m) => m.group_id === g.id).map((m) => m.profile_id);
      for (let m = 1; m <= 12; m++) {
        const meet = new Date(now + (5 + gi * 2 + (m - 4) * 28) * 86400000);
        const kst = new Date(meet.getTime() + 9 * 3600000).toISOString().slice(0, 10);
        const meetIso = new Date(`${kst}T15:00:00+09:00`).toISOString();
        sessions.push({
          id: id("e0000000", ci * 100 + gi * 20 + m), group_id: g.id, company_id: c.id, month: m, meet_at: meetIso,
          place: gi === 0 ? "본사 12층 대회의실" : "본사 9층 세미나실", online_url: null,
          facilitator_id: groupMembers[(m + 1) % groupMembers.length], topic: m <= 4 ? TOPIC[m % 3] : null,
          ...defaultDates(meetIso, settings), created_at: new Date().toISOString(),
        });
      }
    });
  });
  // 총괄 관리자
  const sup = id("f0000000", 1);
  profiles.push({ id: sup, company_id: companies[0].id, emp_no: "9000", name: "인재경영실", rank_level: "팀장급", position: "과장", department: "인재경영실", notify_email: "hq@example.com", role: "super_admin", is_participant: false, must_change_password: false, is_active: true, privacy_agreed_at: new Date(now - 90 * 86400000).toISOString(), last_seen_at: new Date(now - 3600000).toISOString() });
  users.push({ id: sup, email: authEmail("A", "9000"), password: authPassword("9000") });
  // A사 1그룹 첫 팀장을 참가자 겸 관리자로
  const dual = profiles.find((p) => p.emp_no === "1005"); if (dual) { dual.role = "company_admin"; dual.must_change_password = false; }

  const last = sessions.reduce((a, s) => (s.post_due_at > a ? s.post_due_at : a), "");
  settings.final_deadline = new Date(new Date(last).getTime() + 14 * 86400000).toISOString();

  // 제출물
  const submissions: Row[] = [];
  const bookOf = (s: Row) => curricula.find((c) => c.company_id === s.company_id && c.month === s.month)!.book_id;
  const mk = (s: Row, pid: string, f: string, status: string, late: boolean) => {
    const b = bookOf(s), [sum, qs] = IDEAS[b], i = Math.floor(r() * 3);
    const content = f === "pre" ? { summary: (sum + PAD).slice(0, 300 + Math.floor(r() * 40)), quotes: qs.map((t, qi) => ({ text: t, page: String(30 + qi * 47 + Math.floor(r() * 20)) })) }
      : f === "presentation" ? { feeling: FEEL[i], implication: IMPL[(i + 1) % 3], application: APPL[(i + 2) % 3], perspective: PERS[i] }
      : { topic: TOPIC[i], insight: INSI[(i + 1) % 3], expectation: EXPE[(i + 2) % 3] };
    const due = new Date(f === "post" ? s.post_due_at : s.pre_due_at).getTime();
    const at = late ? due + (1 + Math.floor(r() * 4)) * 86400000 : due - (1 + Math.floor(r() * 5)) * 86400000;
    submissions.push({ id: crypto.randomUUID?.() ?? `${s.id}-${pid}-${f}`, session_id: s.id, profile_id: pid, company_id: s.company_id, month: s.month, form_type: f, content, status,
      submitted_at: status === "submitted" ? new Date(Math.min(at, now - 3600000)).toISOString() : null, is_late: status === "submitted" && late, updated_at: new Date(Math.min(at, now - 3600000)).toISOString() });
  };
  for (const s of sessions) {
    const pids = members.filter((m) => m.group_id === s.group_id).map((m) => m.profile_id);
    for (const pid of pids) {
      const p = profiles.find((x) => x.id === pid)!;
      const rep = p.rank_level === "대표급";
      if (new Date(s.post_due_at).getTime() < now) {
        for (const f of ["pre", "presentation", "post"]) {
          const x = r();
          if (p.emp_no === "1001") { mk(s, pid, f, "submitted", false); continue; }
          if (rep) { if (x < 0.35) mk(s, pid, f, "submitted", false); continue; }
          if (x < 0.8) mk(s, pid, f, "submitted", false); else if (x < 0.93) mk(s, pid, f, "submitted", true);
        }
      } else if (new Date(s.open_at).getTime() < now) {
        if (p.emp_no === "1001") { mk(s, pid, "pre", "draft", false); continue; }
        if (rep) continue;
        const x = r(), y = r();
        if (x < 0.45) mk(s, pid, "pre", "submitted", false); else if (x < 0.65) mk(s, pid, "pre", "draft", false);
        if (y < 0.35) mk(s, pid, "presentation", "submitted", false); else if (y < 0.5) mk(s, pid, "presentation", "draft", false);
      }
    }
  }
  const attendance: Row[] = [];
  for (const s of sessions.filter((x) => new Date(x.meet_at).getTime() < now)) {
    members.filter((m) => m.group_id === s.group_id).forEach((m) => attendance.push({ session_id: s.id, profile_id: m.profile_id, company_id: s.company_id, status: r() < 0.92 ? "present" : "absent", note: null, updated_at: new Date().toISOString() }));
  }
  const audit_logs: Row[] = [
    { id: 1, actor_id: id("a0000000", 1), company_id: companies[0].id, action: "대상자 등록", target: "13명 등록 / 0건 오류", reason: null, created_at: new Date(now - 90 * 86400000).toISOString() },
    { id: 2, actor_id: id("a0000000", 2), company_id: companies[1].id, action: "비밀번호 초기화", target: `${profiles.find((p) => p.emp_no === "1103")?.name}(1103)`, reason: "본인 요청", created_at: new Date(now - 20 * 86400000).toISOString() },
  ];
  return {
    tables: {
      companies, profiles, books: BOOKS, app_settings: [settings], study_groups: groups, group_members: members, curricula, sessions, submissions,
      deadline_overrides: [], attendance, email_logs: [], audit_logs, client_errors: [],
    },
    auth: { users, session: null },
    login: {},
  };
}
