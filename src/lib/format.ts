// 날짜 표시는 모두 한국 시간(KST) 기준
const KST = 9 * 3600000;
const k = (d: string | Date) => new Date(new Date(d).getTime() + KST);
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const p2 = (n: number) => String(n).padStart(2, "0");

export const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  const x = k(d);
  return `${x.getUTCMonth() + 1}.${x.getUTCDate()}(${WD[x.getUTCDay()]})`;
};
export const fmtDateTime = (d?: string | null) => {
  if (!d) return "-";
  const x = k(d);
  return `${fmtDate(d)} ${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())}`;
};
export const fmtFull = (d?: string | null) => {
  if (!d) return "-";
  const x = k(d);
  return `${x.getUTCFullYear()}.${p2(x.getUTCMonth() + 1)}.${p2(x.getUTCDate())} ${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())}`;
};
/** ISO → <input type="datetime-local"> 값(KST) */
export const toLocalInput = (d?: string | null) => {
  if (!d) return "";
  const x = k(d);
  return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}T${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())}`;
};
/** <input type="datetime-local"> 값(KST) → ISO */
export const fromLocalInput = (v: string) => (v ? new Date(v + ":00+09:00").toISOString() : "");
/** KST 날짜(yyyy-mm-dd) */
export const kstDay = (d: string | Date) => k(d).toISOString().slice(0, 10);

export function dday(target: string, now = new Date()) {
  const diff = Math.round((Date.parse(kstDay(target)) - Date.parse(kstDay(now))) / 86400000);
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
export function remaining(target: string, now = new Date()) {
  const ms = new Date(target).getTime() - now.getTime();
  if (ms <= 0) return "마감됨";
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}시간 ${Math.floor((ms % 3600000) / 60000)}분 남음`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간 남음`;
}
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const charLen = (s: string) => [...(s ?? "").replace(/\s+/g, " ").trim()].length;
