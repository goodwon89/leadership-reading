import { useState } from "react";
import { AdminHead, useAdminData } from "./common";
import { db, errMsg } from "../../lib/supabase";
import { isRequired } from "../../lib/metrics";
import type { Group } from "../../lib/types";
import { Confirm, Empty, Loading, Modal, useToast } from "../../components/ui";

export default function Groups() {
  const { data, company, companyId, loading, reload } = useAdminData();
  const toast = useToast();
  const [filter, setFilter] = useState<string>("all"); // all | none | groupId
  const [rank, setRank] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [nameEdit, setNameEdit] = useState<Group | "new" | null>(null);
  const [del, setDel] = useState<Group | null>(null);
  if (loading && !data) return <Loading />;
  if (!data) return <Empty>데이터를 불러오지 못했습니다.</Empty>;

  const gOf = new Map(data.members.map((m) => [m.profile_id, m.group_id]));
  const people = data.profiles.filter((p) => p.is_active && p.is_participant);
  const list = people.filter((p) => (filter === "all" ? true : filter === "none" ? !gOf.get(p.id) : gOf.get(p.id) === filter)).filter((p) => !rank || p.rank_level === rank);
  const unassigned = people.filter((p) => !gOf.get(p.id));
  const toggle = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const allSel = list.length > 0 && list.every((p) => sel.has(p.id));

  const move = async () => {
    if (!sel.size) return;
    try {
      if (target === "") {
        const { error } = await db.from("group_members").delete().in("profile_id", [...sel]); if (error) throw error;
        toast(`${sel.size}명의 그룹 배정을 해제했습니다.`);
      } else {
        const { error } = await db.from("group_members").upsert([...sel].map((pid) => ({ profile_id: pid, group_id: target })), { onConflict: "profile_id" }); if (error) throw error;
        toast(`${sel.size}명을 ${data.groups.find((g) => g.id === target)?.name}(으)로 배정했습니다.`);
      }
      setSel(new Set()); reload();
    } catch (e) { toast(errMsg(e), true); }
  };

  return (
    <div className="stack s24">
      <AdminHead company={company} title="토론 그룹 관리" desc="계열사 내부에서 그룹을 만들고 구성원을 배정합니다. 한 사람은 1개 그룹에만 속합니다."
        right={<button className="btn sm" onClick={() => setNameEdit("new")}>그룹 만들기</button>} />
      {unassigned.length > 0 && <div className="banner warn">그룹 미배정 {unassigned.length}명 — {unassigned.slice(0, 5).map((p) => p.name).join(", ")}{unassigned.length > 5 ? " 외" : ""}</div>}

      <div className="grid split">
        <aside className="stack s8">
          <button className={`card tight row between${filter === "all" ? "" : " flat"}`} style={{ textAlign: "left", cursor: "pointer", borderColor: filter === "all" ? "var(--ink)" : undefined }} onClick={() => setFilter("all")}>
            <b>전체 대상자</b><span className="chip">{people.length}</span></button>
          <button className="card tight flat row between" style={{ textAlign: "left", cursor: "pointer", borderColor: filter === "none" ? "var(--ink)" : undefined }} onClick={() => setFilter("none")}>
            <b>미배정</b><span className={`chip ${unassigned.length ? "warn" : ""}`}>{unassigned.length}</span></button>
          {data.groups.map((g) => {
            const ms = people.filter((p) => gOf.get(p.id) === g.id);
            return (
              <div key={g.id} className="card tight flat stack s8" style={{ cursor: "pointer", borderColor: filter === g.id ? "var(--ink)" : undefined }} onClick={() => setFilter(g.id)}>
                <div className="row between"><b>{g.name}</b><span className="chip acc">{ms.length}명</span></div>
                <span className="tiny faint">대표급 {ms.filter((p) => p.rank_level === "대표급").length} · 본부장급 {ms.filter((p) => p.rank_level === "본부장급").length} · 팀장급 {ms.filter((p) => p.rank_level === "팀장급").length} · 과제 대상 {ms.filter(isRequired).length}</span>
                <div className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn xs ghost" onClick={() => setNameEdit(g)}>이름 변경</button>
                  <button className="btn xs ghost" onClick={() => setDel(g)}>삭제</button>
                </div>
              </div>
            );
          })}
          {data.groups.length === 0 && <Empty>그룹이 없습니다. '그룹 만들기'로 시작하세요.</Empty>}
        </aside>

        <section className="stack">
          <div className="row">
            <select value={rank} onChange={(e) => setRank(e.target.value)} style={{ width: "auto" }}><option value="">전체 직급</option><option>대표급</option><option>본부장급</option><option>팀장급</option></select>
            <div className="spacer" />
            <span className="small faint">선택 {sel.size}명 →</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: "auto" }} aria-label="이동할 그룹">
              <option value="">배정 해제</option>{data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}(으)로 이동</option>)}
            </select>
            <button className="btn sm" disabled={!sel.size} onClick={move}>적용</button>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th><input type="checkbox" aria-label="전체 선택" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((p) => p.id)))} /></th>
                <th>성명</th><th>사번</th><th>직급</th><th>부서</th><th>현재 그룹</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} onClick={() => toggle(p.id)} style={{ cursor: "pointer" }}>
                    <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} aria-label={p.name} /></td>
                    <td><b>{p.name}</b></td><td className="num">{p.emp_no}</td><td>{p.rank_level}</td><td className="small">{p.department}</td>
                    <td>{data.groups.find((g) => g.id === gOf.get(p.id))?.name ?? <span className="chip warn">미배정</span>}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={6}><Empty>해당하는 사람이 없습니다.</Empty></td></tr>}
              </tbody>
            </table>
          </div>
          <p className="tiny faint">연중 그룹을 옮기면 이전 회차 기록은 원래 그룹 회차에 남고, 이후 회차는 새 그룹 일정으로 진행됩니다.</p>
        </section>
      </div>

      {nameEdit && <NameModal group={nameEdit === "new" ? null : nameEdit} onClose={() => setNameEdit(null)} onSave={async (name) => {
        try {
          if (nameEdit === "new") { const { error } = await db.from("study_groups").insert({ company_id: companyId, name, year: data.settings.year, sort_order: data.groups.length }); if (error) throw error; }
          else { const { error } = await db.from("study_groups").update({ name }).eq("id", nameEdit.id); if (error) throw error; }
          setNameEdit(null); reload(); toast("저장했습니다.");
        } catch (e) { toast(errMsg(e), true); }
      }} />}
      {del && <Confirm danger title="그룹 삭제" okText="삭제" onClose={() => setDel(null)} onOk={async () => {
        const { error } = await db.from("study_groups").delete().eq("id", del.id);
        if (error) return toast(errMsg(error), true);
        setDel(null); setFilter("all"); reload(); toast("삭제했습니다.");
      }} body={<p><b>{del.name}</b>을(를) 삭제하면 이 그룹의 회차 일정과 해당 회차의 제출물까지 함께 삭제됩니다. 구성원은 미배정 상태가 됩니다. 진행 중인 그룹이라면 구성원을 다른 그룹으로 옮긴 뒤 삭제하세요.</p>} />}
    </div>
  );
}

function NameModal({ group, onClose, onSave }: { group: Group | null; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(group?.name ?? "");
  return (
    <Modal title={group ? "그룹 이름 변경" : "그룹 만들기"} onClose={onClose} footer={<><button className="btn line" onClick={onClose}>취소</button><button className="btn" disabled={!name.trim()} onClick={() => onSave(name.trim())}>저장</button></>}>
      <div className="field"><label>그룹 이름</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 1그룹, 본부장 그룹" autoFocus /></div>
    </Modal>
  );
}
