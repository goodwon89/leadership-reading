import { useEffect, useState } from "react";
import { useHqData } from "./common";
import { callFn, db, errMsg, must } from "../../lib/supabase";
import { fmtFull, fromLocalInput, toLocalInput } from "../../lib/format";
import type { AuditLog, Book, ClientError, Company, EmailLog, Group, Settings } from "../../lib/types";
import { ROLE_LABEL } from "../../lib/types";
import { Empty, Loading, Modal, PageHead, useAsync, useToast } from "../../components/ui";
import { useOpenViewAs } from "../../components/ViewAs";

type Tab = "ops" | "companies" | "books" | "audit" | "mail" | "errors" | "purge";
const TABS: [Tab, string][] = [["ops", "운영 설정"], ["companies", "계열사·관리자"], ["books", "도서 마스터"], ["audit", "감사 로그"], ["errors", "오류 기록"], ["purge", "데이터 파기"]];

export default function HqSettings() {
  const [tab, setTab] = useState<Tab>("ops");
  const hq = useHqData();
  return (
    <div className="stack s24">
      <PageHead label="총괄 관리자" title="설정" />
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {hq.loading && !hq.data ? <Loading /> : !hq.data ? <Empty>데이터를 불러오지 못했습니다.</Empty> : (
        <>
          {tab === "ops" && <Ops settings={hq.data.settings} onSaved={hq.reload} />}
          {tab === "companies" && <Companies data={hq.data} reload={hq.reload} />}
          {tab === "books" && <Books books={hq.data.books} reload={hq.reload} />}
          {tab === "audit" && <Audit data={hq.data} />}
          {tab === "mail" && <Mail data={hq.data} />}
          {tab === "errors" && <Errors data={hq.data} />}
          {tab === "purge" && <Purge settings={hq.data.settings} groups={hq.data.groups} />}
        </>
      )}
    </div>
  );
}

function Ops({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ ...settings, final_deadline: toLocalInput(settings.final_deadline) });
  const num = (k: keyof Settings) => (e: any) => setF({ ...f, [k]: Number(e.target.value) });
  const save = async () => {
    if (f.summary_min > f.summary_max) return toast("요약 최소 글자 수가 최대보다 큽니다.", true);
    const { id: _i, ...rest } = f as any;
    const { error } = await db.from("app_settings").update({ ...rest, final_deadline: fromLocalInput(f.final_deadline), updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast(errMsg(error), true);
    toast("운영 설정을 저장했습니다."); onSaved();
  };
  return (
    <section className="card stack s24" style={{ maxWidth: 760 }}>
      <div className="grid g3">
        <div className="field"><label>운영 연도</label><input type="number" value={f.year} onChange={num("year")} /></div>
        <div className="field"><label>최종 마감일 (지연 제출 한도)</label><input type="datetime-local" value={f.final_deadline} onChange={(e) => setF({ ...f, final_deadline: e.target.value })} /></div>
        <div className="field"><label>플랫폼 주소 (메일 링크)</label><input type="url" value={f.app_url ?? ""} onChange={(e) => setF({ ...f, app_url: e.target.value })} /></div>
      </div>
      <div>
        <span className="flabel">회차 기본 일정 (토론일 D 기준)</span>
        <div className="grid g3" style={{ marginTop: 8 }}>
          <div className="field"><label>오픈 D-</label><input type="number" min={1} value={f.open_offset_days} onChange={num("open_offset_days")} /><span className="help">09:00 오픈</span></div>
          <div className="field"><label>사전학습·발표 마감 D-</label><input type="number" min={0} value={f.pre_due_offset_days} onChange={num("pre_due_offset_days")} /><span className="help">23:59 마감</span></div>
          <div className="field"><label>과제 마감 D+</label><input type="number" min={0} value={f.post_due_offset_days} onChange={num("post_due_offset_days")} /><span className="help">23:59 마감</span></div>
        </div>
        <p className="tiny faint" style={{ marginTop: 6 }}>새로 만드는 회차와 '자동 계산'에 적용됩니다. 이미 만든 회차 일정은 바뀌지 않습니다.</p>
      </div>
      <div>
        <span className="flabel">입력 기준</span>
        <div className="grid g3" style={{ marginTop: 8 }}>
          <div className="field"><label>요약 최소 글자</label><input type="number" value={f.summary_min} onChange={num("summary_min")} /></div>
          <div className="field"><label>요약 최대 글자</label><input type="number" value={f.summary_max} onChange={num("summary_max")} /></div>
          <div className="field"><label>항목별 최소 글자</label><input type="number" value={f.field_min} onChange={num("field_min")} /></div>
        </div>
      </div>
      <div>
        <span className="flabel">문의처·개인정보 안내</span>
        <div className="grid g2" style={{ marginTop: 8 }}>
          <div className="field"><label>문의 메일</label><input type="email" value={f.contact_email ?? ""} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></div>
          <div className="field"><label>문의 전화·내선</label><input type="text" value={f.contact_phone ?? ""} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></div>
          <div className="field"><label>개인정보 보호 담당 (부서·성명)</label><input type="text" value={f.privacy_officer ?? ""} onChange={(e) => setF({ ...f, privacy_officer: e.target.value })} /></div>
          <div className="field"><label>보관 기간</label><input type="text" value={f.retention_text} onChange={(e) => setF({ ...f, retention_text: e.target.value })} placeholder="퇴사 시점까지" /></div>
        </div>
        <p className="tiny faint" style={{ marginTop: 6 }}>푸터와 '개인정보 수집·이용 안내'에 그대로 표시됩니다. 안내문 최종 문구는 인사·법무 검토 후 확정하세요.</p>
      </div>
      <div className="banner info">수료 기준: 본부장·팀장급은 12회 × 3양식 = 36건 모두 제출(지연 제출 포함). 대표급은 수료 판정에서 제외됩니다.</div>
      <div className="btns" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={save}>저장</button></div>
    </section>
  );
}

function Companies({ data, reload }: { data: any; reload: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<Company | "new" | null>(null);
  const [assign, setAssign] = useState(false);
  const openView = useOpenViewAs();
  const admins = data.profiles.filter((p: any) => p.role !== "user");
  const setRole = async (pid: string, role: string) => {
    try { await callFn("admin-users", { action: "set_role", profile_id: pid, role }); toast("권한을 변경했습니다."); reload(); } catch (e) { toast(errMsg(e), true); }
  };
  return (
    <div className="stack s24">
      <section className="stack">
        <div className="row between"><h3>계열사</h3><button className="btn sm" onClick={() => setEdit("new")}>계열사 추가</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th className="r">순서</th><th>코드</th><th>이름</th><th className="r">대상자</th><th>그룹별 편성</th><th>상태</th><th className="r">관리</th></tr></thead>
            <tbody>{data.companies.map((c: Company) => (
              <tr key={c.id}><td className="r">{c.sort_order}</td><td className="num">{c.code}</td><td><b>{c.name}</b></td>
                <td className="r">{data.profiles.filter((p: any) => p.company_id === c.id && p.is_active && p.is_participant).length}</td>
                <td>{c.per_group_curriculum ? "허용" : "-"}</td><td>{c.is_active ? <span className="chip ok">사용</span> : <span className="chip">중지</span>}</td>
                <td className="r"><button className="btn xs ghost" onClick={() => setEdit(c)}>수정</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="stack">
        <div className="row between"><h3>관리자</h3><button className="btn sm" onClick={() => setAssign(true)}>관리자 지정</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>계열사</th><th>성명</th><th>사번</th><th>권한</th><th>교육 대상</th><th className="r">관리</th></tr></thead>
            <tbody>{admins.map((p: any) => (
              <tr key={p.id}><td>{data.companies.find((c: Company) => c.id === p.company_id)?.name}</td><td><b>{p.name}</b></td><td className="num">{p.emp_no}</td>
                <td><span className="chip acc">{ROLE_LABEL[p.role as keyof typeof ROLE_LABEL]}</span></td><td>{p.is_participant ? "예" : "-"}</td>
                <td className="r nowrap">{p.role === "company_admin" && <><button className="btn xs ghost" onClick={() => openView(p.id)}>화면 보기</button><button className="btn xs ghost" onClick={() => setRole(p.id, "user")}>해제</button></>}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="tiny faint">교육 대상자가 아닌 HR 담당자는 '계열사별 관리 → 대상자'에서 등록한 뒤 '교육 대상자' 체크를 해제하고 여기서 관리자로 지정하세요.</p>
      </section>
      {edit && <CompanyModal c={edit === "new" ? null : edit} count={data.companies.length} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {assign && <AssignModal data={data} onClose={() => setAssign(false)} onPick={async (pid) => { await setRole(pid, "company_admin"); setAssign(false); }} />}
    </div>
  );
}

function CompanyModal({ c, count, onClose, onSaved }: { c: Company | null; count: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ code: c?.code ?? "", name: c?.name ?? "", sort_order: c?.sort_order ?? count + 1, is_active: c?.is_active ?? true });
  const save = async () => {
    if (!c && !/^[A-Za-z0-9]{1,10}$/.test(f.code)) return toast("코드는 영문·숫자 10자 이내입니다.", true);
    if (!f.name.trim()) return toast("이름을 입력하세요.", true);
    const r = c ? await db.from("companies").update({ name: f.name, sort_order: f.sort_order, is_active: f.is_active }).eq("id", c.id) : await db.from("companies").insert(f);
    if (r.error) return toast(errMsg(r.error), true);
    toast("저장했습니다."); onSaved();
  };
  return (
    <Modal title={c ? `${c.name} 수정` : "계열사 추가"} onClose={onClose} footer={<><button className="btn line" onClick={onClose}>취소</button><button className="btn" onClick={save}>저장</button></>}>
      <div className="stack">
        <div className="grid g2">
          <div className="field"><label>코드</label><input type="text" value={f.code} disabled={!!c} onChange={(e) => setF({ ...f, code: e.target.value })} /><span className="help">로그인 계정에 쓰이므로 만든 뒤에는 바꿀 수 없습니다.</span></div>
          <div className="field"><label>이름</label><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>표시 순서</label><input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />사용 (해제 시 로그인 목록에서 숨김)</label>
      </div>
    </Modal>
  );
}

function AssignModal({ data, onClose, onPick }: { data: any; onClose: () => void; onPick: (pid: string) => void }) {
  const [cid, setCid] = useState(data.companies[0]?.id ?? "");
  const [q, setQ] = useState("");
  const list = data.profiles.filter((p: any) => p.company_id === cid && p.role === "user" && p.is_active && (!q || p.name.includes(q) || p.emp_no.includes(q)));
  return (
    <Modal title="각 사 관리자 지정" onClose={onClose}>
      <div className="stack">
        <div className="grid g2">
          <select value={cid} onChange={(e) => setCid(e.target.value)}>{data.companies.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input type="search" placeholder="이름·사번" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="stack s8" style={{ maxHeight: 320, overflow: "auto" }}>
          {list.map((p: any) => <div key={p.id} className="row between nowrap"><span><b>{p.name}</b> <span className="faint small">{p.emp_no} · {p.department}</span></span><button className="btn xs" onClick={() => onPick(p.id)}>지정</button></div>)}
          {list.length === 0 && <p className="small faint">대상이 없습니다. 먼저 대상자로 등록하세요.</p>}
        </div>
      </div>
    </Modal>
  );
}

function Books({ books, reload }: { books: Book[]; reload: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState(books);
  useEffect(() => setRows(books), [books]);
  const set = (id: number, k: keyof Book, v: string) => setRows(rows.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const save = async () => {
    for (const b of rows) {
      const { error } = await db.from("books").update({ category: b.category, title: b.title, author: b.author, summary: b.summary, recommended_by: b.recommended_by || null, cover_url: b.cover_url || null }).eq("id", b.id);
      if (error) return toast(errMsg(error), true);
    }
    toast("도서 정보를 저장했습니다."); reload();
  };
  return (
    <div className="stack">
      <p className="small muted">별첨1 도서 목록(총 12권). 표지 이미지 주소를 넣으면 참가자 홈에 표지가 표시됩니다.</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>No</th><th>분야</th><th>도서명</th><th>저자</th><th>핵심 내용</th><th>추천</th><th>표지 URL</th></tr></thead>
          <tbody>{rows.map((b) => (
            <tr key={b.id}><td>{b.no}</td>
              <td><select value={b.category} onChange={(e) => set(b.id, "category", e.target.value)} style={{ minHeight: 34, padding: "4px 8px" }}><option value="경영">경제·경영</option><option value="인문">인문</option></select></td>
              {(["title", "author", "summary", "recommended_by", "cover_url"] as const).map((k) => <td key={k}><input type="text" value={(b[k] as string) ?? ""} onChange={(e) => set(b.id, k, e.target.value)} style={{ minHeight: 34, padding: "4px 8px", minWidth: k === "summary" ? 260 : 120 }} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="btns" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={save}>저장</button></div>
    </div>
  );
}

function Audit({ data }: { data: any }) {
  const q = useAsync(() => must<AuditLog[]>(db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300)), []);
  if (q.loading) return <Loading />;
  const who = (id: string | null) => data.profiles.find((p: any) => p.id === id)?.name ?? "시스템";
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>일시</th><th>계열사</th><th>처리자</th><th>작업</th><th>대상</th><th>사유</th></tr></thead>
        <tbody>
          {(q.data ?? []).map((a) => <tr key={a.id}><td className="small nowrap">{fmtFull(a.created_at)}</td><td>{data.companies.find((c: Company) => c.id === a.company_id)?.name ?? "-"}</td><td>{who(a.actor_id)}</td><td><b>{a.action}</b></td><td className="small">{a.target}</td><td className="small">{a.reason ?? "-"}</td></tr>)}
          {!q.data?.length && <tr><td colSpan={6}><Empty>기록이 없습니다.</Empty></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Mail({ data }: { data: any }) {
  const q = useAsync(() => must<EmailLog[]>(db.from("email_logs").select("*").order("sent_at", { ascending: false }).limit(300)), []);
  if (q.loading) return <Loading />;
  const TYPE: Record<string, string> = { open: "회차 오픈", pre_d3: "사전 마감 D-3", pre_d1: "사전 마감 D-1", post_remind: "과제 리마인드", overdue_pre: "미제출(사전)", overdue_post: "미제출(과제)", admin_overdue: "관리자 미제출 요약", weekly: "주간 요약", manual: "수동 독려", account: "계정 안내" };
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>일시</th><th>유형</th><th>받는 사람</th><th>주소</th><th>결과</th></tr></thead>
        <tbody>
          {(q.data ?? []).map((m) => <tr key={m.id}><td className="small nowrap">{fmtFull(m.sent_at)}</td><td>{TYPE[m.type] ?? m.type}</td><td>{data.profiles.find((p: any) => p.id === m.profile_id)?.name ?? "-"}</td><td className="small">{m.to_email ?? "-"}</td>
            <td>{m.result === "sent" ? <span className="chip ok">발송</span> : m.result === "failed" ? <span className="chip bad" title={m.error ?? ""}>실패</span> : <span className="chip" title={m.error ?? ""}>제외</span>}{m.error && <div className="tiny faint">{m.error}</div>}</td></tr>)}
          {!q.data?.length && <tr><td colSpan={5}><Empty>발송 기록이 없습니다.</Empty></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Errors({ data }: { data: any }) {
  const q = useAsync(() => must<ClientError[]>(db.from("client_errors").select("*").order("created_at", { ascending: false }).limit(300)), []);
  if (q.loading) return <Loading />;
  return (
    <div className="stack">
      <p className="small muted">참가자·관리자 화면에서 난 오류가 자동으로 기록됩니다. "제출이 안 돼요" 같은 문의가 오면 이름으로 찾아 보세요.</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>일시</th><th>사용자</th><th>오류</th><th>화면</th><th>기기</th></tr></thead>
          <tbody>
            {(q.data ?? []).map((e) => <tr key={e.id}><td className="small nowrap">{fmtFull(e.created_at)}</td><td>{data.profiles.find((p: any) => p.id === e.profile_id)?.name ?? "-"}</td>
              <td className="small" title={e.detail ?? ""}><b>{e.message}</b></td><td className="tiny">{(e.url ?? "").split("#")[1] ?? "-"}</td><td className="tiny faint">{/iPhone|Android/.test(e.user_agent ?? "") ? "휴대폰" : "PC"}</td></tr>)}
            {!q.data?.length && <tr><td colSpan={5}><Empty>기록된 오류가 없습니다.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Purge({ settings, groups }: { settings: Settings; groups: Group[] }) {
  const toast = useToast();
  const years = [...new Set(groups.map((g) => g.year))].sort();
  const [year, setYear] = useState<number>(years[0] ?? settings.year);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const phrase = `${year}년 데이터 파기`;
  const run = async () => {
    setBusy(true);
    try { const { data, error } = await db.rpc("purge_year", { p_year: year }); if (error) throw error; toast(`${year}년 데이터를 파기했습니다. (제출물 ${data}건)`); setTyped(""); }
    catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <section className="card stack" style={{ maxWidth: 640 }}>
      <h3>보관 기간이 지난 연도 데이터 파기</h3>
      <p className="small muted">선택한 연도의 토론 그룹, 회차 일정, 제출물, 출석, 기한 연장 기록이 모두 삭제되며 되돌릴 수 없습니다. 계정과 감사 로그는 남습니다. 보관 기간: {settings.retention_text}</p>
      <div className="banner warn">파기 전에 '분기 보고' 또는 '내보내기'에서 필요한 자료를 엑셀로 보관하세요.</div>
      <div className="field"><label>연도</label><select value={year} onChange={(e) => setYear(Number(e.target.value))}>{(years.length ? years : [settings.year]).map((y) => <option key={y} value={y}>{y}년</option>)}</select></div>
      <div className="field"><label>확인 문구 입력</label><input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={phrase} /><span className="help">'{phrase}'를 그대로 입력해야 실행됩니다.</span></div>
      <button className="btn danger" disabled={typed !== phrase || busy} onClick={run}>{busy ? "파기 중…" : "영구 삭제"}</button>
    </section>
  );
}
