export type Role = "user" | "company_admin" | "super_admin";
export type Rank = "대표급" | "본부장급" | "팀장급";
export type FormType = "pre" | "presentation" | "post";
export const FORM_TYPES: FormType[] = ["pre", "presentation", "post"];

export interface Company { id: string; code: string; name: string; sort_order: number; per_group_curriculum: boolean; is_active: boolean; }
export interface Profile {
  id: string; company_id: string; emp_no: string; name: string; rank_level: Rank;
  position: string | null; department: string | null; notify_email: string | null;
  role: Role; is_participant: boolean; must_change_password: boolean; is_active: boolean; created_at?: string;
  privacy_agreed_at?: string | null; last_seen_at?: string | null;
}
export interface Book { id: number; no: number; category: "경영" | "인문"; title: string; author: string; summary: string | null; recommended_by: string | null; cover_url: string | null; }
export interface Settings {
  id: 1; year: number; open_offset_days: number; pre_due_offset_days: number; post_due_offset_days: number;
  final_deadline: string; summary_min: number; summary_max: number; field_min: number; mail_enabled: boolean; app_url: string | null;
  contact_email: string | null; contact_phone: string | null; privacy_officer: string | null; retention_text: string;
}
export interface Group { id: string; company_id: string; name: string; year: number; sort_order: number; }
export interface Member { profile_id: string; group_id: string; assigned_at?: string; }
export interface Curriculum { id?: string; company_id: string; group_id: string | null; month: number; book_id: number; }
export interface Session {
  id: string; group_id: string; company_id: string; month: number; meet_at: string; place: string | null; online_url: string | null;
  facilitator_id: string | null; topic: string | null; open_at: string; pre_due_at: string; post_due_at: string;
}
export interface Submission {
  id: string; session_id: string; profile_id: string; company_id: string; month: number; form_type: FormType;
  content?: Record<string, any>; status: "draft" | "submitted"; submitted_at: string | null; is_late: boolean; updated_at: string;
}
export interface Override { id: string; session_id: string; profile_id: string; company_id: string; form_type: FormType; new_due_at: string; reason: string; granted_by: string | null; created_at: string; }
export interface Attendance { session_id: string; profile_id: string; company_id: string; status: "present" | "absent"; note: string | null; }
export interface AuditLog { id: number; actor_id: string | null; company_id: string | null; action: string; target: string | null; reason: string | null; created_at: string; }
export interface ClientError { id: number; profile_id: string | null; message: string; detail: string | null; url: string | null; user_agent: string | null; created_at: string; }
export interface EmailLog { id: number; profile_id: string | null; company_id: string | null; type: string; session_id: string | null; to_email: string | null; result: string; error: string | null; sent_at: string; }

/** 원문 표기: 경제·경영 / 인문 */
export const catLabel = (c?: string | null) => (c === "경영" ? "경제·경영" : c ?? "");
export const FORM_LABEL: Record<FormType, string> = { pre: "사전학습", presentation: "발표자료", post: "과제" };
export const ROLE_LABEL: Record<Role, string> = { user: "사용자", company_admin: "각 사 관리자", super_admin: "총괄 관리자" };
