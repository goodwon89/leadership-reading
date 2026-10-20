// 엑셀 라이브러리는 내려받기·업로드를 누를 때만 불러옴 (첫 화면 가볍게)
const loadXlsx = () => import("xlsx");

export type SheetDef = { name: string; rows: Record<string, any>[]; widths?: number[] };

export async function downloadXlsx(filename: string, sheets: SheetDef[]) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ "": "데이터 없음" }]);
    const keys = Object.keys(s.rows[0] ?? {});
    ws["!cols"] = (s.widths ?? keys.map((k) => Math.min(60, Math.max(8, k.length * 2 + 2, ...s.rows.slice(0, 50).map((r) => String(r[k] ?? "").length + 2))))).map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export const MEMBER_COLUMNS = ["사번", "성명", "직급구분", "직책", "부서", "회사메일", "토론그룹"] as const;

export function downloadMemberTemplate() {
  return downloadXlsx("대상자_등록_양식.xlsx", [
    { name: "대상자", rows: [
      { 사번: "2027001", 성명: "홍길동", 직급구분: "팀장급", 직책: "팀장", 부서: "전략기획팀", 회사메일: "gildong@company.com", 토론그룹: "1그룹" },
    ], widths: [12, 10, 10, 10, 16, 28, 10] },
    { name: "작성 안내", rows: [
      { 항목: "사번", 설명: "필수. 최초 비밀번호로 사용됩니다." },
      { 항목: "성명", 설명: "필수" },
      { 항목: "직급구분", 설명: "필수. 대표급 / 본부장급 / 팀장급 중 하나 (대표급은 과제 제출 대상 아님)" },
      { 항목: "직책·부서", 설명: "선택" },
      { 항목: "회사메일", 설명: "선택. 알림 메일 수신 주소" },
      { 항목: "토론그룹", 설명: "선택. 같은 이름의 그룹이 없으면 새로 만듭니다." },
    ], widths: [12, 70] },
  ]);
}

export interface MemberRow { emp_no: string; name: string; rank_level: string; position?: string; department?: string; notify_email?: string; group_name?: string; _error?: string; }

export async function parseMemberFile(file: File): Promise<MemberRow[]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
  const v = (r: Record<string, any>, k: string) => String(r[k] ?? "").trim();
  return raw.map((r) => {
    const row: MemberRow = {
      emp_no: v(r, "사번"), name: v(r, "성명"), rank_level: v(r, "직급구분"), position: v(r, "직책"),
      department: v(r, "부서"), notify_email: v(r, "회사메일"), group_name: v(r, "토론그룹"),
    };
    const errs: string[] = [];
    if (!row.emp_no) errs.push("사번 없음");
    if (!row.name) errs.push("성명 없음");
    if (!["대표급", "본부장급", "팀장급"].includes(row.rank_level)) errs.push("직급구분 오류");
    if (row.notify_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.notify_email)) errs.push("메일 형식");
    if (errs.length) row._error = errs.join(", ");
    return row;
  }).filter((r) => r.emp_no || r.name);
}
