import { useMemo, useState } from "react";
import { AdminHead, useAdminData } from "./common";
import NudgeModal from "./Nudge";
import { useAuth } from "../../state/auth";
import { callFn, db, DEMO, errMsg } from "../../lib/supabase";
import { downloadMemberTemplate, MemberRow, parseMemberFile } from "../../lib/excel";
import { Profile, Rank, ROLE_LABEL } from "../../lib/types";
import { Confirm, Empty, Loading, Modal, useToast } from "../../components/ui";
import { fmtDate } from "../../lib/format";
import { useOpenViewAs } from "../../components/ViewAs";

const RANKS: Rank[] = ["대표급", "본부장급", "팀장급"];

export default function Members() {
  const { data, company, companyId, loading, reload } = useAdminData();
  const { isSuper, realMe, viewAs } = useAuth();
  const openView = useOpenViewAs();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [purge, setPurge] = useState<Profile | null>(null);
  const [rank, setRank] = useState("");
  const [grp, setGrp] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [neverSeen, setNeverSeen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Profile | "new" | null>(null);
  const [upload, setUpload] = useState(false);
  const [confirm, setConfirm] = useState<{ p: Profile; kind: "reset" | "active" } | null>(null);
  const [mail, setMail] = useState<Profile[] | null>(null);

  const groupOf = useMemo(() => new Map((data?.members ?? []).map((m) => [m.profile_id, data!.groups.find((g) => g.id === m.group_id)?.name])), [data]);
  if (loading && !data) return <Loading />;
  if (!data) return <Empty>데이터를 불러오지 못했습니다.</Empty>;

  const list = data.profiles
    .filter((p) => showInactive || p.is_active)
    .filter((p) => !rank || p.rank_level === rank)
    .filter((p) => !grp || (grp === "-" ? !groupOf.get(p.id) : groupOf.get(p.id) === grp))
    .filter((p) => !neverSeen || !p.last_seen_at)
    .filter((p) => !q || [p.name, p.emp_no, p.department, p.position].some((x) => x?.includes(q)));
  const allSel = list.length > 0 && list.every((p) => sel.has(p.id));
  const toggle = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };

  // 퇴사 처리: 총괄 관리자는 일반·관리자 계정, 각 사 관리자는 일반 계정만 (본인·총괄 관리자 제외)
  const canPurge = (p: Profile) => !viewAs && p.id !== realMe?.id && p.role !== "super_admin" && (realMe?.role === "super_admin" || p.role === "user");

  const doConfirm = async () => {
    if (!confirm) return;
    const { p, kind } = confirm;
    try {
      if (kind === "reset") { await callFn("admin-users", { action: "reset_password", profile_id: p.id, reason: "관리자 초기화" }); toast(`${p.name}님의 비밀번호를 사번으로 초기화했습니다.`); }
      else { await callFn("admin-users", { action: "set_active", profile_id: p.id, active: !p.is_active, reason: p.is_active ? "대상 제외" : "재활성" }); toast(p.is_active ? "비활성 처리했습니다. 수료 집계에서 제외됩니다." : "다시 활성화했습니다."); }
      setConfirm(null); reload();
    } catch (e) { toast(errMsg(e), true); }
  };

  return (
    <div className="stack s24">
      <AdminHead company={company} title="대상자 관리" desc={`활성 ${data.profiles.filter((p) => p.is_active && p.is_participant).length}명 · 비활성 ${data.profiles.filter((p) => !p.is_active).length}명`}
        right={<>
          <button className="btn sm line" onClick={downloadMemberTemplate}>엑셀 양식</button>
          <button className="btn sm sec2" onClick={() => setUpload(true)}>엑셀 일괄 등록</button>
          <button className="btn sm" onClick={() => setEdit("new")}>개별 등록</button>
        </>} />

      <div className="row" style={{ gap: 8 }}>
        <input type="search" placeholder="이름·사번·부서 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <select value={rank} onChange={(e) => setRank(e.target.value)} style={{ width: "auto" }}><option value="">전체 직급</option>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
        <select value={grp} onChange={(e) => setGrp(e.target.value)} style={{ width: "auto" }}><option value="">전체 그룹</option><option value="-">미배정</option>{data.groups.map((g) => <option key={g.id}>{g.name}</option>)}</select>
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />비활성 포함</label>
        <label className="check"><input type="checkbox" checked={neverSeen} onChange={(e) => setNeverSeen(e.target.checked)} />한 번도 접속 안 한 사람 ({data.profiles.filter((p) => p.is_active && !p.last_seen_at).length})</label>
        <div className="spacer" />
        {sel.size > 0 && <button className="btn sm sec2" onClick={() => setMail(data.profiles.filter((p) => sel.has(p.id)))}>선택 {sel.size}명 안내 메일</button>}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th><input type="checkbox" aria-label="전체 선택" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((p) => p.id)))} /></th>
            <th>사번</th><th>성명</th><th>직급</th><th>직책 · 부서</th><th>그룹</th><th>알림 메일</th><th>최근 접속</th><th>상태</th><th className="r">관리</th>
          </tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                <td><input type="checkbox" aria-label={`${p.name} 선택`} checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="num">{p.emp_no}</td>
                <td><b>{p.name}</b>{p.role !== "user" && <span className="chip acc" style={{ marginLeft: 6 }}>{ROLE_LABEL[p.role]}</span>}</td>
                <td>{p.rank_level}{!p.is_participant && <div className="tiny faint">교육 대상 아님</div>}</td>
                <td className="small">{p.position}<div className="tiny faint">{p.department}</div></td>
                <td>{groupOf.get(p.id) ?? <span className="chip warn">미배정</span>}</td>
                <td className="small">{p.notify_email ?? <span className="faint">-</span>}</td>
                <td className="small nowrap">{p.last_seen_at ? fmtDate(p.last_seen_at) : <span className="chip warn">미접속</span>}</td>
                <td>{!p.is_active ? <span className="chip">비활성</span> : p.must_change_password ? <span className="chip line">비번 변경 전</span> : <span className="chip ok">사용 중</span>}</td>
                <td className="r nowrap">
                  {realMe?.role === "super_admin" && !viewAs && p.role !== "super_admin" && <button className="btn xs ghost" onClick={() => openView(p.id)}>화면 보기</button>}
                  <button className="btn xs ghost" onClick={() => setEdit(p)}>수정</button>
                  <button className="btn xs ghost" onClick={() => setConfirm({ p, kind: "reset" })}>비번 초기화</button>
                  <button className="btn xs ghost" onClick={() => setConfirm({ p, kind: "active" })}>{p.is_active ? "비활성" : "활성"}</button>
                  {canPurge(p) && <button className="btn xs ghost" style={{ color: "var(--bad)" }} onClick={() => setPurge(p)}>퇴사 처리</button>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={10}><Empty>조건에 맞는 대상자가 없습니다.</Empty></td></tr>}
          </tbody>
        </table>
      </div>

      {edit && <EditModal profile={edit === "new" ? null : edit} companyId={companyId} groups={data.groups} members={data.members} isSuper={isSuper} companies={data.companies}
        onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {upload && <UploadModal companyId={companyId} onClose={() => setUpload(false)} onDone={() => { reload(); }} />}
      {confirm && (
        <Confirm title={confirm.kind === "reset" ? "비밀번호 초기화" : confirm.p.is_active ? "계정 비활성" : "계정 활성화"}
          danger={confirm.kind === "active" && confirm.p.is_active} onClose={() => setConfirm(null)} onOk={doConfirm}
          body={confirm.kind === "reset"
            ? <p>{confirm.p.name}({confirm.p.emp_no})님의 비밀번호를 <b>사번</b>으로 초기화합니다. 다음 로그인 때 비밀번호 변경이 필요합니다.</p>
            : confirm.p.is_active ? <p>{confirm.p.name}님을 비활성 처리합니다. 로그인이 막히고 수료 집계에서 제외되며, 기존 제출 기록은 보존됩니다.</p>
            : <p>{confirm.p.name}님을 다시 활성화합니다.</p>} />
      )}
      {purge && <PurgeModal p={purge} onClose={() => setPurge(null)} onDone={() => { setPurge(null); reload(); }} />}
      {mail && <NudgeModal people={mail} onClose={() => setMail(null)} subject="[Read to Lead] 리더십 2년차 독서교육 계정 안내"
        message={`{name}님, 안녕하세요.\n'27 리더십 2년차 독서교육 플랫폼 'Read to Lead' 계정이 준비되었습니다.\n로그인: 소속 계열사 선택 → 사번 입력 → 최초 비밀번호는 본인 사번입니다.\n첫 로그인 후 반드시 새 비밀번호로 변경해 주세요.`} />}
    </div>
  );
}

function PurgeModal({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [emp, setEmp] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await callFn<{ deleted_submissions: number }>("admin-users", { action: "purge", profile_id: p.id, confirm_emp_no: emp.trim(), reason: "퇴사" });
      toast(`퇴사 처리했습니다. 계정과 교육 기록(제출물 ${r?.deleted_submissions ?? 0}건)을 삭제했습니다.`);
      onDone();
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <Modal title="퇴사 처리" onClose={onClose} footer={<>
      <button className="btn line" onClick={onClose}>취소</button>
      <button className="btn danger" disabled={busy || emp.trim() !== p.emp_no} onClick={run}>{busy ? "처리 중…" : "삭제하고 퇴사 처리"}</button>
    </>}>
      <div className="stack">
        <p><b>{p.name}({p.emp_no})</b>님의 계정과 교육 기록을 <b>복구할 수 없도록 삭제</b>합니다.</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>삭제: 로그인 계정, 인적 정보, 사전학습·발표자료·과제 제출물, 출석, 그룹 배정, 기한 연장 기록</li>
          <li>Facilitator로 지정된 회차는 Facilitator가 비워지니 다시 지정해 주세요.</li>
          <li>제출 현황·수료 집계에서도 빠집니다. 필요한 기록은 먼저 <b>내보내기</b>로 받아 두세요.</li>
          <li>감사 기록에는 처리자, 일시, 사번, 삭제 건수만 남습니다.</li>
        </ul>
        <div className="banner bad"><span>휴직·잠시 대상 제외라면 퇴사 처리 대신 <b>비활성</b>을 쓰세요. 비활성은 기록이 보존됩니다.</span></div>
        <div className="field"><label htmlFor="purge-emp">확인을 위해 사번 <b>{p.emp_no}</b>를 입력하세요</label>
          <input id="purge-emp" type="text" value={emp} onChange={(e) => setEmp(e.target.value)} autoComplete="off" /></div>
      </div>
    </Modal>
  );
}

function EditModal({ profile, companyId, groups, members, isSuper, companies, onClose, onSaved }: {
  profile: Profile | null; companyId: string; groups: { id: string; name: string }[]; members: { profile_id: string; group_id: string }[];
  isSuper: boolean; companies: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    emp_no: profile?.emp_no ?? "", name: profile?.name ?? "", rank_level: profile?.rank_level ?? "팀장급", position: profile?.position ?? "",
    department: profile?.department ?? "", notify_email: profile?.notify_email ?? "", is_participant: profile?.is_participant ?? true,
    group_id: members.find((m) => m.profile_id === profile?.id)?.group_id ?? "", role: profile?.role ?? "user", company_id: profile?.company_id ?? companyId,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => {
    if (!f.emp_no.trim() || !f.name.trim()) return toast("사번과 성명은 필수입니다.", true);
    setBusy(true);
    try {
      if (!profile) {
        const r = await callFn<{ results: { ok: boolean; error?: string }[] }>("admin-users", { action: "create", company_id: companyId, rows: [{ ...f, group_name: groups.find((g) => g.id === f.group_id)?.name }] });
        if (!r.results[0]?.ok) throw new Error(r.results[0]?.error ?? "등록 실패");
        toast(`${f.name}님을 등록했습니다. 최초 비밀번호는 사번입니다.`);
      } else {
        const { error } = await db.from("profiles").update({ name: f.name, rank_level: f.rank_level, position: f.position || null, department: f.department || null, notify_email: f.notify_email || null, is_participant: f.is_participant }).eq("id", profile.id);
        if (error) throw error;
        const cur = members.find((m) => m.profile_id === profile.id)?.group_id ?? "";
        if (f.group_id !== cur) {
          if (f.group_id) { const r = await db.from("group_members").upsert({ profile_id: profile.id, group_id: f.group_id }, { onConflict: "profile_id" }); if (r.error) throw r.error; }
          else await db.from("group_members").delete().eq("profile_id", profile.id);
        }
        if (isSuper && f.role !== profile.role) await callFn("admin-users", { action: "set_role", profile_id: profile.id, role: f.role });
        if (isSuper && f.company_id !== profile.company_id) await callFn("admin-users", { action: "move_company", profile_id: profile.id, company_id: f.company_id, reason: "계열사 이동" });
        toast("저장했습니다.");
      }
      onSaved();
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <Modal title={profile ? `${profile.name} 정보 수정` : "대상자 개별 등록"} onClose={onClose} footer={<><button className="btn line" onClick={onClose}>취소</button><button className="btn" disabled={busy} onClick={save}>{busy ? "저장 중…" : "저장"}</button></>}>
      <div className="stack">
        <div className="grid g2">
          <div className="field"><label>사번</label><input type="text" value={f.emp_no} onChange={set("emp_no")} disabled={!!profile} />{!profile && <span className="help">최초 비밀번호로 사용됩니다.</span>}</div>
          <div className="field"><label>성명</label><input type="text" value={f.name} onChange={set("name")} /></div>
          <div className="field"><label>직급 구분</label><select value={f.rank_level} onChange={set("rank_level")}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="field"><label>토론 그룹</label><select value={f.group_id} onChange={set("group_id")}><option value="">미배정</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div className="field"><label>직책</label><input type="text" value={f.position} onChange={set("position")} /></div>
          <div className="field"><label>부서</label><input type="text" value={f.department} onChange={set("department")} /></div>
        </div>
        <div className="field"><label>알림 메일 (회사 메일)</label><input type="email" value={f.notify_email} onChange={set("notify_email")} /></div>
        {profile && <label className="check"><input type="checkbox" checked={f.is_participant} onChange={set("is_participant")} />교육 대상자 (해제 시 HR 담당자 등 관리 전용 계정)</label>}
        {profile && isSuper && (
          <div className="grid g2">
            <div className="field"><label>권한</label><select value={f.role} onChange={set("role")}>{(["user", "company_admin", "super_admin"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            <div className="field"><label>소속 계열사 (이동)</label><select value={f.company_id} onChange={set("company_id")}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><span className="help">이동 시 그룹 배정이 해제되고 로그인 계열사가 바뀝니다.</span></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function UploadModal({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [results, setResults] = useState<{ emp_no: string; ok: boolean; error?: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = rows?.filter((r) => !r._error) ?? [];
  const submit = async () => {
    setBusy(true);
    try {
      const r = await callFn<{ results: any[] }>("admin-users", { action: "create", company_id: companyId, rows: valid });
      setResults(r.results); onDone();
      toast(`${r.results.filter((x) => x.ok).length}명 등록 완료`);
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <Modal wide title="엑셀 일괄 등록" onClose={onClose} footer={results ? <button className="btn" onClick={onClose}>닫기</button> : <>
      <button className="btn line" onClick={onClose}>취소</button>
      <button className="btn" disabled={!valid.length || busy} onClick={submit}>{busy ? "등록 중…" : `${valid.length}명 등록`}</button></>}>
      <div className="stack">
        {!rows && <>
          <p className="small muted">'엑셀 양식'을 내려받아 작성한 뒤 업로드하세요. 등록되면 최초 비밀번호는 각자의 사번입니다.{DEMO && " (데모: 실제 계정은 만들어지지 않고 이 브라우저에만 저장됩니다.)"}</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setRows(await parseMemberFile(f)); } catch { toast("파일을 읽지 못했습니다.", true); } } }} />
        </>}
        {rows && !results && <>
          <p className="small">{rows.length}행 중 <b>{valid.length}행</b> 등록 가능{rows.length - valid.length ? ` · 오류 ${rows.length - valid.length}행은 제외됩니다.` : ""}</p>
          <div className="tbl-wrap" style={{ maxHeight: 360 }}>
            <table><thead><tr><th>사번</th><th>성명</th><th>직급</th><th>부서</th><th>메일</th><th>그룹</th><th>검증</th></tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}><td>{r.emp_no}</td><td>{r.name}</td><td>{r.rank_level}</td><td>{r.department}</td><td className="small">{r.notify_email}</td><td>{r.group_name}</td>
                <td>{r._error ? <span className="chip bad">{r._error}</span> : <span className="chip ok">OK</span>}</td></tr>)}</tbody></table>
          </div>
        </>}
        {results && (
          <div className="tbl-wrap" style={{ maxHeight: 360 }}>
            <table><thead><tr><th>사번</th><th>결과</th></tr></thead>
              <tbody>{results.map((r, i) => <tr key={i}><td>{r.emp_no}</td><td>{r.ok ? <span className="chip ok">등록</span> : <span className="chip bad">{r.error}</span>}</td></tr>)}</tbody></table>
          </div>
        )}
      </div>
    </Modal>
  );
}
