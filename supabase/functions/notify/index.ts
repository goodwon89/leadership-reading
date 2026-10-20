// 메일 알림 서버 함수
//  mode=cron     : 매일 09:00(KST) 예약 실행 — 회차 오픈 / 마감 리마인드 / 미제출 / 주간 요약
//  mode=manual   : 관리자 수동 독려 메일
//  mode=accounts : 계정 안내 메일
import { admin, canManage, corsHeaders, getCaller, json } from "../_shared/common.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "인재경영실 <no-reply@example.com>";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

/** 메일 HTML에 넣는 값은 모두 특수문자를 바꿔 넣음 */
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const FORM_LABEL: Record<string, string> = { pre: "사전학습", presentation: "발표자료", post: "과제" };
const DAY = 86400000;
const kstDate = (d: Date | string) => new Date(new Date(d).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const kstText = (d: string) => {
  const k = new Date(new Date(d).getTime() + 9 * 3600000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};
const shift = (d: string, days: number) => kstDate(new Date(new Date(d).getTime() + days * DAY));

function layout(title: string, lines: string[], url?: string) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;line-height:1.6">${l}</p>`).join("");
  const btn = url
    ? `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#1C1917;color:#fff;padding:12px 20px;border-radius:99px;text-decoration:none;font-weight:700">플랫폼 바로가기</a></p>`
    : "";
  return `<div style="font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1C1917">
  <p style="color:#00807F;font-weight:700;margin:0 0 8px">리더십 2년차 독서교육</p>
  <h2 style="margin:0 0 20px;font-size:20px">${title}</h2>${body}${btn}
  <p style="color:#79716B;font-size:12px;margin-top:32px">배움은 생존을 위한 가장 공격적인 투자다 · 상상인그룹 인재경영실</p></div>`;
}

async function send(db: any, to: string | null, subject: string, html: string,
  log: { profile_id?: string; company_id?: string; type: string; session_id?: string; dedupe_key?: string }) {
  if (log.dedupe_key) {
    const { data } = await db.from("email_logs").select("id").eq("dedupe_key", log.dedupe_key).maybeSingle();
    if (data) return "dup";
  }
  let result = "sent", error: string | null = null;
  if (!to) { result = "skipped"; error = "알림 메일 주소 없음"; }
  else if (!RESEND_API_KEY) { result = "skipped"; error = "RESEND_API_KEY 미설정"; }
  else {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    });
    if (!r.ok) { result = "failed"; error = (await r.text()).slice(0, 500); }
  }
  await db.from("email_logs").insert({ ...log, to_email: to, result, error });
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = admin();
  const body = await req.json().catch(() => ({}));
  const { data: settings } = await db.from("app_settings").select("*").eq("id", 1).single();
  const appUrl = settings?.app_url ?? "";

  // ------------------------------------------------------------ 수동/계정
  if (body.mode === "manual" || body.mode === "accounts") {
    const caller = await getCaller(req, db);
    if (!caller || caller.role === "user") return json({ error: "관리자만 사용할 수 있습니다." }, 403);
    const { data: people } = await db.from("profiles").select("*, companies(code, name)").in("id", body.profile_ids ?? []);
    let sent = 0, skipped = 0, failed = 0;
    for (const p of people ?? []) {
      if (!canManage(caller, p.company_id)) continue;
      let subject: string, html: string, type: string;
      if (body.mode === "accounts") {
        type = "account";
        subject = "[리더십 2년차] 독서교육 플랫폼 계정 안내";
        html = layout(`${esc(p.name)}님, 플랫폼 계정이 준비되었습니다`, [
          `접속 주소: <a href="${esc(appUrl)}">${esc(appUrl)}</a>`,
          `로그인 방법: 계열사 <b>${esc(p.companies?.name)}</b> 선택 → 사번 <b>${esc(p.emp_no)}</b> 입력 → 최초 비밀번호는 <b>본인 사번</b>입니다.`,
          "첫 로그인 후 반드시 새 비밀번호(영문·숫자 포함 8자 이상)로 변경해 주세요.",
          "비밀번호를 잊은 경우 소속사 HR 담당자에게 초기화를 요청하세요.",
        ], appUrl);
      } else {
        type = "manual";
        subject = String(body.subject || "[리더십 2년차] 제출 안내").replace(/[\r\n]/g, " ").slice(0, 150);
        html = layout(esc(subject.replace(/^\[[^\]]+\]\s*/, "")),
          String(body.message || "").split("\n").filter(Boolean).map((l) => esc(l).replace(/\{name\}/g, esc(p.name))), appUrl);
      }
      const r = await send(db, p.notify_email, subject, html, { profile_id: p.id, company_id: p.company_id, type, session_id: body.session_id });
      if (r === "sent") sent++; else if (r === "failed") failed++; else skipped++;
    }
    return json({ sent, skipped, failed });
  }

  // ------------------------------------------------------------ 예약 실행
  if (body.mode !== "cron") return json({ error: "알 수 없는 요청" }, 400);
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);
  if (settings && settings.mail_enabled === false) return json({ ok: true, note: "mail disabled" });

  const today = kstDate(new Date());
  const [{ data: sessions }, { data: members }, { data: profiles }, { data: subs }, { data: overrides }, { data: books }, { data: curricula }] =
    await Promise.all([
      db.from("sessions").select("*"),
      db.from("group_members").select("*"),
      db.from("profiles").select("*").eq("is_active", true),
      db.from("submissions").select("profile_id, month, form_type, status"),
      db.from("deadline_overrides").select("session_id, profile_id, form_type"),
      db.from("books").select("*"),
      db.from("curricula").select("*"),
    ]);
  const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const done = new Set((subs ?? []).filter((s: any) => s.status === "submitted").map((s: any) => `${s.profile_id}:${s.month}:${s.form_type}`));
  const hasOverride = new Set((overrides ?? []).map((o: any) => `${o.session_id}:${o.profile_id}:${o.form_type}`));
  const bookOf = (s: any) => {
    const c = (curricula ?? []).find((x: any) => x.group_id === s.group_id && x.month === s.month)
      ?? (curricula ?? []).find((x: any) => x.company_id === s.company_id && !x.group_id && x.month === s.month);
    return (books ?? []).find((b: any) => b.id === c?.book_id);
  };
  const stats = { sent: 0, skipped: 0, failed: 0, dup: 0 } as Record<string, number>;
  const tally = (r: string) => (stats[r] = (stats[r] ?? 0) + 1);
  const overdueByCompany = new Map<string, string[]>();

  for (const s of sessions ?? []) {
    const people = (members ?? []).filter((m: any) => m.group_id === s.group_id).map((m: any) => pmap.get(m.profile_id))
      .filter((p: any) => p && p.is_participant);
    const required = people.filter((p: any) => p.rank_level !== "대표급");
    const book = bookOf(s);
    const title = book ? `《${esc(book.title)}》` : `${s.month}월 도서`;
    const missing = (p: any, forms: string[]) =>
      forms.filter((f) => !done.has(`${p.id}:${s.month}:${f}`) && !hasOverride.has(`${s.id}:${p.id}:${f}`));

    // 회차 오픈
    if (kstDate(s.open_at) === today) {
      for (const p of people) {
        tally(await send(db, p.notify_email, `[리더십 2년차] ${s.month}월 회차가 열렸습니다 — ${title}`,
          layout(`${s.month}월 회차가 열렸습니다`, [
            `이번 달 도서: <b>${title}</b>${book ? ` · ${esc(book.author)}` : ""}`,
            `토론 일시: ${kstText(s.meet_at)}${s.place ? ` · ${esc(s.place)}` : ""}`,
            s.topic ? `발제 주제: ${esc(s.topic)}` : "",
            p.rank_level === "대표급" ? "대표급은 과제 제출 대상이 아니며, 자유롭게 작성하실 수 있습니다."
              : `사전학습·발표자료 마감: <b>${kstText(s.pre_due_at)}</b> / 과제 마감: <b>${kstText(s.post_due_at)}</b>`,
          ].filter(Boolean), appUrl),
          { profile_id: p.id, company_id: s.company_id, type: "open", session_id: s.id, dedupe_key: `open:${s.id}:${p.id}` }));
      }
    }
    // 사전 마감 D-3, D-1
    for (const d of [3, 1]) {
      if (shift(s.pre_due_at, -d) !== today) continue;
      for (const p of required) {
        const m = missing(p, ["pre", "presentation"]);
        if (!m.length) continue;
        tally(await send(db, p.notify_email, `[리더십 2년차] ${m.map((f) => FORM_LABEL[f]).join("·")} 마감 ${d}일 전`,
          layout(`${title} ${m.map((f) => FORM_LABEL[f]).join("·")} 마감이 ${d}일 남았습니다`,
            [`마감: <b>${kstText(s.pre_due_at)}</b>`, "작성 중인 내용은 자동 저장됩니다. 제출 버튼을 눌러야 제출로 인정됩니다."], appUrl),
          { profile_id: p.id, company_id: s.company_id, type: `pre_d${d}`, session_id: s.id, dedupe_key: `pre_d${d}:${s.id}:${p.id}` }));
      }
    }
    // 과제 리마인드 (마감 2일 전 = D+5)
    if (shift(s.post_due_at, -2) === today) {
      for (const p of required) {
        if (!missing(p, ["post"]).length) continue;
        tally(await send(db, p.notify_email, `[리더십 2년차] ${s.month}월 과제 마감 2일 전`,
          layout(`${title} 과제 마감이 2일 남았습니다`, [`마감: <b>${kstText(s.post_due_at)}</b>`, "토론 주제·인사이트·기대사항을 정리해 제출해 주세요."], appUrl),
          { profile_id: p.id, company_id: s.company_id, type: "post_remind", session_id: s.id, dedupe_key: `post_remind:${s.id}:${p.id}` }));
      }
    }
    // 미제출 알림 (마감 다음 날)
    const overdue: [string, string[]][] = [];
    if (shift(s.pre_due_at, 1) === today) overdue.push(["pre", ["pre", "presentation"]]);
    if (shift(s.post_due_at, 1) === today) overdue.push(["post", ["post"]]);
    for (const [kind, forms] of overdue) {
      for (const p of required) {
        const m = missing(p, forms);
        if (!m.length) continue;
        const list = overdueByCompany.get(s.company_id) ?? [];
        list.push(`${esc(p.name)}(${esc(p.emp_no)}) · ${s.month}월 ${m.map((f) => FORM_LABEL[f]).join("·")}`);
        overdueByCompany.set(s.company_id, list);
        tally(await send(db, p.notify_email, `[리더십 2년차] ${s.month}월 ${m.map((f) => FORM_LABEL[f]).join("·")} 미제출 안내`,
          layout("마감이 지났습니다 — 지연 제출 안내", [
            `${title} ${m.map((f) => FORM_LABEL[f]).join("·")}가 아직 제출되지 않았습니다.`,
            "12회 전 회차를 모두 제출해야 수료할 수 있습니다. 지금 제출하면 '지연 제출'로 기록되며 수료에는 인정됩니다.",
          ], appUrl),
          { profile_id: p.id, company_id: s.company_id, type: `overdue_${kind}`, session_id: s.id, dedupe_key: `overdue_${kind}:${s.id}:${p.id}` }));
      }
    }
  }

  // 관리자 대상: 미제출 목록 + 월요일 주간 요약
  const isMonday = new Date(Date.now() + 9 * 3600000).getUTCDay() === 1;
  const admins = (profiles ?? []).filter((p: any) => p.role === "company_admin");
  for (const a of admins) {
    const list = overdueByCompany.get(a.company_id);
    if (list?.length) {
      tally(await send(db, a.notify_email, `[리더십 2년차] 미제출자 ${list.length}건 안내`,
        layout("마감 후 미제출 현황", [...list.slice(0, 50), list.length > 50 ? `외 ${list.length - 50}건` : ""].filter(Boolean), appUrl),
        { profile_id: a.id, company_id: a.company_id, type: "admin_overdue", dedupe_key: `admin_overdue:${today}:${a.id}` }));
    }
    if (isMonday) {
      const mine = (profiles ?? []).filter((p: any) => p.company_id === a.company_id && p.is_participant && p.rank_level !== "대표급");
      const opened = (sessions ?? []).filter((s: any) => s.company_id === a.company_id && new Date(s.pre_due_at) < new Date());
      let need = 0, got = 0;
      for (const p of mine) {
        const gid = (members ?? []).find((m: any) => m.profile_id === p.id)?.group_id;
        for (const s of opened.filter((x: any) => x.group_id === gid)) {
          const forms = new Date(s.post_due_at) < new Date() ? ["pre", "presentation", "post"] : ["pre", "presentation"];
          for (const f of forms) { need++; if (done.has(`${p.id}:${s.month}:${f}`)) got++; }
        }
      }
      tally(await send(db, a.notify_email, "[리더십 2년차] 주간 제출 현황",
        layout("주간 제출 현황", [
          `대상자 ${mine.length}명 · 마감 지난 양식 기준 제출률 <b>${need ? Math.round((got / need) * 100) : 0}%</b> (${got}/${need})`,
          "상세 현황은 플랫폼 관리자 화면에서 확인하세요.",
        ], appUrl),
        { profile_id: a.id, company_id: a.company_id, type: "weekly", dedupe_key: `weekly:${today}:${a.id}` }));
    }
  }
  return json({ ok: true, today, ...stats });
});
