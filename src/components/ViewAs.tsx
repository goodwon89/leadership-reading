import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { db, errMsg } from "../lib/supabase";
import type { Company, Profile } from "../lib/types";
import { ROLE_LABEL } from "../lib/types";
import { Modal, useAsync, useToast } from "./ui";

/** 총괄 관리자: 특정 계정 화면 열기 */
export function useOpenViewAs() {
  const { startViewAs } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  return async (profileId: string) => {
    try { const m = await startViewAs(profileId); nav(m === "admin" ? "/admin" : "/", { replace: true }); }
    catch (e) { toast(errMsg(e), true); }
  };
}

/** 계정 화면 보기 중 상단 띠 */
export function ViewAsBar() {
  const { viewAs, company, stopViewAs } = useAuth();
  const nav = useNavigate();
  if (!viewAs) return null;
  return (
    <div className="viewas-bar" role="status">
      <span><b>{viewAs.name}</b> ({company?.name} · {viewAs.rank_level} · {ROLE_LABEL[viewAs.role]}) 계정의 화면을 보는 중입니다. 읽기 전용이라 저장·변경은 되지 않습니다.</span>
      <button className="btn xs" onClick={() => { stopViewAs(); nav("/hq", { replace: true }); }}>보기 종료</button>
    </div>
  );
}

/** 계정 선택 창 */
export function ViewAsPicker({ onClose }: { onClose: () => void }) {
  const open = useOpenViewAs();
  const [cid, setCid] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const data = useAsync(async () => {
    const [c, p] = await Promise.all([db.from("companies").select("*").order("sort_order"), db.from("profiles").select("*").neq("role", "super_admin").eq("is_active", true).order("emp_no")]);
    return { companies: (c.data ?? []) as Company[], profiles: (p.data ?? []) as Profile[] };
  }, []);
  const companies = data.data?.companies ?? [];
  const list = (data.data?.profiles ?? [])
    .filter((p) => !cid || p.company_id === cid)
    .filter((p) => !role || (role === "admin" ? p.role === "company_admin" : role === "user" ? p.role === "user" : p.rank_level === role))
    .filter((p) => !q || p.name.includes(q) || p.emp_no.includes(q));
  return (
    <Modal wide title="계정 화면 보기" onClose={onClose}>
      <div className="stack">
        <p className="small muted">선택한 사람이 로그인했을 때 보는 화면을 그대로 열어 봅니다. 읽기 전용이며, 상단 '보기 종료'로 돌아옵니다.</p>
        <div className="row">
          <select value={cid} onChange={(e) => setCid(e.target.value)} style={{ width: "auto" }}><option value="">전체 계열사</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "auto" }}>
            <option value="">전체</option><option value="admin">각 사 관리자</option><option value="user">교육 대상자</option><option value="대표급">대표급</option><option value="본부장급">본부장급</option><option value="팀장급">팀장급</option>
          </select>
          <input type="search" placeholder="이름·사번" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <div className="tbl-wrap" style={{ maxHeight: 420 }}>
          <table>
            <thead><tr><th>계열사</th><th>성명</th><th>사번</th><th>직급</th><th>권한</th><th className="r"></th></tr></thead>
            <tbody>
              {list.slice(0, 200).map((p) => (
                <tr key={p.id}>
                  <td className="small">{companies.find((c) => c.id === p.company_id)?.name}</td>
                  <td><b>{p.name}</b></td><td className="num small">{p.emp_no}</td><td className="small">{p.rank_level}</td>
                  <td>{p.role === "company_admin" ? <span className="chip acc">각 사 관리자{p.is_participant ? " · 대상자" : ""}</span> : <span className="chip">교육 대상자</span>}</td>
                  <td className="r"><button className="btn xs" onClick={() => { onClose(); open(p.id); }}>화면 보기</button></td>
                </tr>
              ))}
              {data.loading && <tr><td colSpan={6} className="faint small">불러오는 중…</td></tr>}
              {!data.loading && !list.length && <tr><td colSpan={6} className="faint small">해당하는 사람이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
