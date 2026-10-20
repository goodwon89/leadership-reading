import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CellStatus } from "../lib/metrics";

// ---------------- icons ----------------
const P = (d: string) => (props: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={props.size ?? 20} height={props.size ?? 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const Icon = {
  home: P("M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"),
  book: P("M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20"),
  pen: P("M4 20h4L19 9l-4-4L4 16zM14 6l4 4"),
  user: P("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"),
  sun: P("M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"),
  moon: P("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"),
  out: P("M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"),
  x: P("M18 6 6 18M6 6l12 12"),
  up: P("m6 15 6-6 6 6"),
  down: P("m6 9 6 6 6-6"),
  expand: P("M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"),
  download: P("M12 3v12m0 0-5-5m5 5 5-5M4 21h16"),
  swap: P("M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"),
};

// ---------------- toast ----------------
type ToastT = { msg: string; bad?: boolean } | null;
const ToastCtx = createContext<(msg: string, bad?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastT>(null);
  const timer = useRef<number>();
  const show = useCallback((msg: string, bad?: boolean) => {
    setT({ msg, bad }); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), bad ? 4500 : 2600);
  }, []);
  return <ToastCtx.Provider value={show}>{children}{t && <div className={`toast${t.bad ? " bad" : ""}`} role="status">{t.msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

// ---------------- modal ----------------
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-h"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="닫기"><Icon.x /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, body, okText = "확인", danger, onOk, onClose }: { title: string; body: ReactNode; okText?: string; danger?: boolean; onOk: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn line" onClick={onClose}>취소</button>
      <button className={`btn${danger ? " danger" : ""}`} disabled={busy} onClick={async () => { setBusy(true); try { await onOk(); } finally { setBusy(false); } }}>{busy ? "처리 중…" : okText}</button>
    </>}>{body}</Modal>
  );
}

// ---------------- status ----------------
export function StatusChip({ status, overdue, open = true, optional }: { status: CellStatus; overdue?: boolean; open?: boolean; optional?: boolean }) {
  if (!open && status === "none") return <span className="chip line">예정</span>;
  if (status === "submitted") return <span className="chip ok">제출</span>;
  if (status === "late") return <span className="chip warn">지연제출</span>;
  if (status === "draft") return <span className={`chip ${overdue && !optional ? "bad" : "warn"}`}>임시저장</span>;
  if (overdue && !optional) return <span className="chip bad">미제출</span>;
  return <span className="chip">미작성</span>;
}
export const dotClass = (s: CellStatus, overdue: boolean, open: boolean) =>
  s === "submitted" ? "ok" : s === "late" ? "warn" : overdue ? "bad" : s === "draft" ? "warn" : open ? "none" : "none";

export function Bar({ value, ink }: { value: number; ink?: boolean }) {
  return <div className={`bar${ink ? " ink" : ""}`}><i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div>;
}
export function BarCell({ value }: { value: number }) {
  return <div className="barcell"><Bar value={value} /><b className="num">{Math.round(value * 1000) / 10}%</b></div>;
}
export function Kpi({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return <div className="kpi"><span className="kpi-l">{label}</span><span className="kpi-v num">{value}{unit && <small>{unit}</small>}</span>{sub && <span className="kpi-s">{sub}</span>}</div>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
export function Loading() { return <div className="empty">불러오는 중…</div>; }
export function PageHead({ label, title, desc, right }: { label?: string; title: ReactNode; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-h">
      {label && <span className="label">{label}</span>}
      <div className="row between nowrap" style={{ alignItems: "flex-end" }}>
        <h1>{title}</h1>{right && <div className="btns">{right}</div>}
      </div>
      {desc && <p className="muted">{desc}</p>}
    </div>
  );
}

export function BookCover({ title, author, category, url }: { title: string; author: string; category?: string; url?: string | null }) {
  if (url) return <div className="book-cover" style={{ padding: 0 }}><img src={url} alt={title} /></div>;
  return (
    <div className="book-cover" aria-hidden="true">
      <span className="label">{category === "경영" ? "경제·경영" : category}</span>
      <b>{title}</b>
      <span className="small" style={{ color: "var(--text-2)" }}>{author}</span>
    </div>
  );
}

/** 간단한 비동기 로더 훅 */
export function useAsync<T>(fn: () => Promise<T>, deps: any[]): { data: T | null; error: string | null; loading: boolean; reload: () => void; setData: (v: T) => void } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: e?.message ?? String(e), loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1), setData: (v: T) => setState((s) => ({ ...s, data: v })) };
}
