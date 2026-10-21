// 더미 데이터 생성/삭제 스크립트 (화면 점검용)
// - 6개 계열사(상상인, 상상인플러스저축은행, 시너지이노베이션, 메디카코리아, 엠아이텍, 바스노바)
// - 각 사 HR 관리자 1명 + 교육 대상자, 토론 그룹, 연간 도서 편성, 12회차 일정, 제출물·출석
// - 일정은 '오늘' 기준으로 1~3월 회차 종료, 4월 회차 진행 중이 되도록 배치 (실제 2027년 일정 아님)
// - 더미 계정 사번은 모두 'D'로 시작, 비밀번호 = 사번 (예: D101 / D101)
// - 총괄 관리자 계정과 실제 데이터는 건드리지 않음
//
// 사용 (Node 18+):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/dummy-data.js seed
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/dummy-data.js clear
// 실제 운영 전에 반드시 clear 로 지우세요.

async function dummy(mode, URL, KEY) {
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  const rest = async (method, path, body, prefer) => {
    const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers: { ...H, Prefer: prefer ?? "return=representation" }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${t.slice(0, 300)}`);
    return t ? JSON.parse(t) : null;
  };
  const authApi = async (method, path, body) => {
    const r = await fetch(`${URL}/auth/v1/admin/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (!r.ok) throw new Error(`auth ${method} ${path} ${r.status}: ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
  const DOMAIN = "reading.sangsangin.local";
  const email = (code, emp) => `${code}_${emp}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "") + "@" + DOMAIN;
  const COMPANIES = [
    { code: "SSI", name: "상상인" }, { code: "SSIplus", name: "상상인플러스저축은행" }, { code: "SYN", name: "시너지이노베이션" },
    { code: "MDK", name: "메디카코리아" }, { code: "MIT", name: "엠아이텍" }, { code: "BVN", name: "바스노바" },
  ];

  // ------------------------------------------------------------------ clear
  if (mode === "clear") {
    const codes = COMPANIES.map((c) => c.code);
    const comps = await rest("GET", `companies?select=*&code=in.(${codes.join(",")})`);
    const ids = comps.map((c) => c.id);
    if (!ids.length) return { removedUsers: 0 };
    const dummies = await rest("GET", `profiles?select=id,company_id,emp_no&company_id=in.(${ids.join(",")})&emp_no=like.D*`);
    for (const p of dummies) await authApi("DELETE", `users/${p.id}`);
    for (const id of ids) {
      await rest("DELETE", `study_groups?company_id=eq.${id}&name=like.${encodeURIComponent("토론*")}`, null, "return=minimal");
      await rest("DELETE", `curricula?company_id=eq.${id}`, null, "return=minimal");
      await rest("DELETE", `email_logs?company_id=eq.${id}`, null, "return=minimal");
      await rest("DELETE", `audit_logs?company_id=eq.${id}`, null, "return=minimal");
    }
    // 실제 계정이 남아 있지 않은 더미 계열사만 삭제 (총괄 관리자 소속 계열사는 유지)
    let removedCompanies = 0;
    for (const c of comps) {
      const left = await rest("GET", `profiles?select=id&company_id=eq.${c.id}`);
      if (!left.length) { await rest("DELETE", `companies?id=eq.${c.id}`, null, "return=minimal"); removedCompanies++; }
    }
    return { removedUsers: dummies.length, removedCompanies };
  }

  // ------------------------------------------------------------------ seed
  const SUR = "김이박최정강조윤장임한오서신권황안송류홍".split("");
  const GIV = ["민준", "서연", "도윤", "지우", "현우", "수빈", "지훈", "예린", "성민", "하은", "재원", "유진", "태호", "나연", "승현", "다은", "정우", "소희", "동현", "미경", "상훈", "혜진", "준호", "은지", "영수"];
  const SAMPLES = [[11, 1, 12, 2, 10, 3, 9, 5, 8, 4, 6, 7], [11, 4, 9, 3, 8, 2, 10, 5, 12, 6, 1, 7], [4, 11, 3, 8, 2, 10, 6, 9, 5, 12, 1, 7]];
  const IDEAS = {
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
  const PERS = ["좋은 직언과 상처 주는 말의 경계는 어디인가? 각자의 경험을 듣고 싶다.", "우리 조직에서 '적합한 사람'의 기준은 무엇이어야 하는가? 채용과 배치 관점에서 이야기하고 싶다.", "성과 압박이 큰 상황에서 구성원의 내재적 동기를 어떻게 지킬 수 있을까? 실제 사례를 나누고 싶다."];
  const TOPIC = ["리더의 피드백이 신뢰로 이어지는 조건과, 우리 조직에서 솔직한 피드백을 가로막는 요인", "위기 상황에서 리더의 책임과 권한 위임의 균형을 어떻게 잡을 것인가", "성과와 성장의 균형을 잡는 팀 운영 방식과 리더의 역할"];
  const INSI = ["같은 원칙도 조직의 상황에 따라 다르게 적용된다는 점을 다른 리더들의 사례로 확인했다. 정답보다 맥락을 읽는 힘이 중요하다.", "구성원이 말하지 않는 것은 문제가 없어서가 아니라 말할 통로가 없어서일 수 있다는 의견이 인상 깊었다.", "토론을 통해 리더 혼자 해결하려는 습관을 내려놓고 팀의 집단 지성을 활용하는 방법을 다시 생각하게 되었다."];
  const EXPE = ["팀원들과 이번 토론 내용을 공유하고, 다음 분기 팀 운영 원칙에 한 가지 이상 반영하는 것을 목표로 하겠다.", "그룹 차원에서 리더 간 경험을 꾸준히 나누는 자리가 이어지기를 기대한다. 다음 회차까지 실천 결과를 정리해 오겠다.", "개인적으로는 감정적인 반응을 줄이고, 조직 차원에서는 솔직한 피드백이 오가는 회의 문화를 만들고 싶다."];
  const DEPTS = ["경영지원", "영업", "전략기획", "R&D", "재무", "IT", "리스크관리", "마케팅"];
  let seedN = 20271021; const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
  const now = Date.now(), DAY = 864e5;
  const kstDay = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
  const at = (day, hm) => new Date(`${day}T${hm}:00+09:00`).toISOString();

  // 운영 설정: 문의처
  await rest("PATCH", "app_settings?id=eq.1", { contact_email: "kwjang@sangsanginworld.co.kr", privacy_officer: "인재경영실 장근원 과장" }, "return=minimal");

  // 계열사 (있으면 유지)
  const existing = await rest("GET", "companies?select=*");
  const comps = [];
  for (const [i, c] of COMPANIES.entries()) {
    let row = existing.find((x) => x.code === c.code);
    if (!row) row = (await rest("POST", "companies", { code: c.code, name: c.name, sort_order: i + 1 }))[0];
    else await rest("PATCH", `companies?id=eq.${row.id}`, { sort_order: i + 1 }, "return=minimal");
    comps.push(row);
  }
  const sizes = [12, 10, 9, 9, 8, 8];
  const created = { users: 0, groups: 0, sessions: 0, submissions: 0 };
  let n = 0;
  for (const [ci, comp] of comps.entries()) {
    const code = comp.code;
    // 계정
    const people = [];
    const mkUser = async (emp, prof) => {
      const u = await authApi("POST", "users", { email: email(code, emp), password: "rd!" + emp, email_confirm: true });
      const p = (await rest("POST", "profiles", { id: u.id, company_id: comp.id, emp_no: emp, ...prof, must_change_password: false, is_active: true,
        privacy_agreed_at: new Date(now - 30 * DAY).toISOString() }))[0];
      created.users++; return p;
    };
    for (let k = 0; k < sizes[ci]; k++) {
      n++;
      const emp = `D${ci + 1}${String(k + 1).padStart(2, "0")}`;
      const rank = k === sizes[ci] - 1 ? "대표급" : k <= 2 ? "본부장급" : "팀장급";
      const dept = DEPTS[(n * 3) % DEPTS.length];
      people.push(await mkUser(emp, {
        name: SUR[(n * 7) % SUR.length] + GIV[(n * 11) % GIV.length], rank_level: rank,
        position: rank === "대표급" ? "대표이사" : rank === "본부장급" ? "본부장" : "팀장",
        department: rank === "대표급" ? "경영진" : dept + (rank === "팀장급" ? "팀" : "본부"),
        notify_email: null, role: ci === 0 && k === 3 ? "company_admin" : "user", is_participant: true,
        last_seen_at: k % 6 === 5 ? null : new Date(now - ((n * 13) % 20) * DAY).toISOString(),
      }));
    }
    await mkUser(`D${ci + 1}90`, { name: `${comp.name.slice(0, 3)} HR담당`, rank_level: "팀장급", position: "HR 담당", department: "인사팀", notify_email: null,
      role: "company_admin", is_participant: false, last_seen_at: new Date(now - DAY).toISOString() });

    // 그룹·편성·회차
    const gCount = sizes[ci] >= 10 ? 2 : 1;
    const groups = await rest("POST", "study_groups", Array.from({ length: gCount }, (_, gi) => ({ company_id: comp.id, name: `토론 ${gi + 1}그룹`, year: 2027, sort_order: gi })));
    created.groups += groups.length;
    const gOf = (k) => groups[k % gCount].id;
    await rest("POST", "group_members", people.map((p, k) => ({ profile_id: p.id, group_id: gOf(k) })), "return=minimal");
    await rest("POST", "curricula", SAMPLES[ci % 3].map((b, i) => ({ company_id: comp.id, group_id: null, month: i + 1, book_id: b })), "return=minimal");
    const sessions = [];
    for (const [gi, g] of groups.entries()) {
      const members = people.filter((_, k) => gOf(k) === g.id);
      for (let m = 1; m <= 12; m++) {
        const meetDay = kstDay(now + (5 + gi * 2 + ci + (m - 4) * 28) * DAY);
        const meetMs = Date.parse(at(meetDay, "15:00"));
        sessions.push({ group_id: g.id, month: m, meet_at: at(meetDay, "15:00"), place: gi === 0 ? "본사 대회의실" : "본사 세미나실", online_url: null,
          facilitator_id: members[(m + 1) % members.length].id, topic: m <= 4 ? TOPIC[m % 3] : null,
          open_at: at(kstDay(meetMs - 14 * DAY), "09:00"), pre_due_at: at(kstDay(meetMs - DAY), "23:59"), post_due_at: at(kstDay(meetMs + 7 * DAY), "23:59") });
      }
    }
    const sRows = await rest("POST", "sessions", sessions);
    created.sessions += sRows.length;

    // 제출물·출석
    const bookOf = (m) => SAMPLES[ci % 3][m - 1];
    const subs = [], att = [];
    const mk = (s, p, f, status, late) => {
      const [sum, qs] = IDEAS[bookOf(s.month)], i = Math.floor(rnd() * 3);
      const content = f === "pre" ? { summary: (sum + PAD).slice(0, 330), quotes: qs.map((t, qi) => ({ text: t, page: String(30 + qi * 47 + Math.floor(rnd() * 20)) })) }
        : f === "presentation" ? { feeling: FEEL[i], implication: IMPL[(i + 1) % 3], application: APPL[(i + 2) % 3], perspective: PERS[i] }
        : { topic: TOPIC[i], insight: INSI[(i + 1) % 3], expectation: EXPE[(i + 2) % 3] };
      const due = Date.parse(f === "post" ? s.post_due_at : s.pre_due_at);
      const t = Math.min(late ? due + (1 + Math.floor(rnd() * 4)) * DAY : due - (1 + Math.floor(rnd() * 5)) * DAY, now - 3600e3);
      subs.push({ session_id: s.id, profile_id: p.id, form_type: f, content, status, submitted_at: status === "submitted" ? new Date(t).toISOString() : null, is_late: status === "submitted" && late });
    };
    for (const s of sRows) {
      const members = people.filter((p) => people.indexOf(p) >= 0 && gOf(people.indexOf(p)) === s.group_id);
      for (const p of members) {
        const rep = p.rank_level === "대표급", star = p.emp_no.endsWith("01");
        if (Date.parse(s.post_due_at) < now) {
          for (const f of ["pre", "presentation", "post"]) {
            const x = rnd();
            if (star) { mk(s, p, f, "submitted", false); continue; }
            if (rep) { if (x < 0.35) mk(s, p, f, "submitted", false); continue; }
            if (x < 0.8) mk(s, p, f, "submitted", false); else if (x < 0.93) mk(s, p, f, "submitted", true);
          }
        } else if (Date.parse(s.open_at) < now) {
          if (star) { mk(s, p, "pre", "submitted", false); mk(s, p, "presentation", "draft", false); continue; }
          if (rep) continue;
          const x = rnd(), y = rnd();
          if (x < 0.45) mk(s, p, "pre", "submitted", false); else if (x < 0.65) mk(s, p, "pre", "draft", false);
          if (y < 0.35) mk(s, p, "presentation", "submitted", false); else if (y < 0.5) mk(s, p, "presentation", "draft", false);
        }
        if (Date.parse(s.meet_at) < now) att.push({ session_id: s.id, profile_id: p.id, status: rnd() < 0.92 ? "present" : "absent", note: null });
      }
    }
    for (let i = 0; i < subs.length; i += 200) await rest("POST", "submissions", subs.slice(i, i + 200), "return=minimal");
    if (att.length) await rest("POST", "attendance", att, "return=minimal");
    created.submissions += subs.length;
  }
  return { companies: comps.length, ...created };
}

if (typeof process !== "undefined" && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  if (!["seed", "clear"].includes(mode)) { console.log("usage: node scripts/dummy-data.js seed|clear"); process.exit(1); }
  dummy(mode, process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY).then((r) => console.log(r), (e) => { console.error(e.message); process.exit(1); });
}

export { dummy };
