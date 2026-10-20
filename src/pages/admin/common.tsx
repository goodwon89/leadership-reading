import { ReactNode, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { loadDataset } from "../../lib/data";
import { Tracker } from "../../lib/metrics";
import { PageHead, useAsync } from "../../components/ui";
import { ADMIN_NAV } from "../../components/Layout";
import type { Company } from "../../lib/types";
import { db } from "../../lib/supabase";

/** 관리자 화면 공통 데이터 (선택 계열사 기준) */
export function useAdminData() {
  const { scopeCompanyId } = useAuth();
  const q = useAsync(() => loadDataset(scopeCompanyId), [scopeCompanyId]);
  const tracker = useMemo(() => (q.data ? new Tracker(q.data) : null), [q.data]);
  const company = q.data?.companies.find((c) => c.id === scopeCompanyId) ?? null;
  return { ...q, tracker, company, companyId: scopeCompanyId! };
}

function CompanyPicker() {
  const { scopeCompanyId, setScopeCompanyId } = useAuth();
  const q = useAsync<Company[]>(async () => { const r = await db.from("companies").select("*").order("sort_order"); return (r.data ?? []) as Company[]; }, []);
  return (
    <select value={scopeCompanyId ?? ""} onChange={(e) => setScopeCompanyId(e.target.value)} style={{ width: "auto", minWidth: 160 }} aria-label="계열사 선택">
      {(q.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

/** 관리자 페이지 머리말: 총괄은 계열사 선택 + 관리 메뉴 탭 */
export function AdminHead({ title, desc, right, company }: { title: ReactNode; desc?: ReactNode; right?: ReactNode; company?: Company | null }) {
  const { isSuper } = useAuth();
  return (
    <>
      {isSuper && (
        <div className="stack s8" style={{ marginBottom: 20 }}>
          <div className="row"><span className="small faint">관리 대상 계열사</span><CompanyPicker /></div>
          <div className="tabs">{ADMIN_NAV.map((i) => <NavLink key={i.to} to={i.to} end={i.end} style={{ textDecoration: "none" }}>{({ isActive }) => <button tabIndex={-1} aria-selected={isActive}>{i.label}</button>}</NavLink>)}</div>
        </div>
      )}
      <PageHead label={company ? `${company.name} 관리` : "관리"} title={title} desc={desc} right={right} />
    </>
  );
}
