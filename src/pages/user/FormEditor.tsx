import { useCallback, useEffect, useRef, useState } from "react";
import { db, errMsg } from "../../lib/supabase";
import { emptyContent, FORM_FIELDS, validateContent } from "../../lib/rules";
import { charLen, fmtDateTime, fmtFull, remaining } from "../../lib/format";
import { FORM_LABEL, FormType, Profile, Session, Settings, Submission } from "../../lib/types";
import { Confirm, StatusChip, useToast } from "../../components/ui";
import SubmissionView from "../../components/SubmissionView";
import type { Cell } from "../../lib/metrics";

const lsGet = (k: string) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

interface Props { me: Profile; session: Session; form: FormType; cell: Cell; settings: Settings; onSaved: (s: Submission) => void; }

export default function FormEditor({ me, session, form, cell, settings, onSaved }: Props) {
  const toast = useToast();
  const sub = cell.sub;
  const key = `lr-draft:${me.id}:${session.id}:${form}`;
  const rep = me.rank_level === "대표급";
  const now = new Date();
  const submitted = sub?.status === "submitted";
  const dueAt = cell.due ? new Date(cell.due) : null;
  const finalPassed = now > new Date(settings.final_deadline);
  const notOpen = !cell.open;
  const locked = (submitted && !!dueAt && now > dueAt) || (!submitted && finalPassed && !!dueAt && now > dueAt);

  const [content, setContent] = useState<Record<string, any>>(() => sub?.content && Object.keys(sub.content).length ? sub.content : emptyContent(form));
  const [restored, setRestored] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(sub?.updated_at ?? null);
  const dirtyRef = useRef(false);

  // 브라우저에 남은 작성본 복구 (네트워크 끊김 대비)
  useEffect(() => {
    const b = lsGet(key);
    if (b && (!sub || new Date(b.at) > new Date(sub.updated_at)) && !locked) { setContent(b.content); setRestored(true); setDirty(true); dirtyRef.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: Record<string, any>) => {
    setContent(next); setDirty(true); dirtyRef.current = true;
    lsSet(key, { at: new Date().toISOString(), content: next });
    if (Object.keys(errors).length) setErrors(validateContent(form, next, settings));
  };

  const save = useCallback(async (status: "draft" | "submitted", silent = false) => {
    setBusy(true);
    try {
      const { data, error } = await db.from("submissions").upsert(
        { session_id: session.id, profile_id: me.id, form_type: form, content, status: submitted ? "submitted" : status },
        { onConflict: "session_id,profile_id,form_type" },
      ).select().single();
      if (error) throw error;
      lsDel(key); setDirty(false); dirtyRef.current = false; setSavedAt(data.updated_at); setRestored(false);
      onSaved(data);
      if (!silent) toast(status === "submitted" ? (data.is_late ? "지연 제출되었습니다." : "제출되었습니다.") : "임시저장했습니다.");
    } catch (e) { if (!silent) toast(errMsg(e), true); } finally { setBusy(false); }
  }, [content, form, key, me.id, onSaved, session.id, submitted, toast]);

  // 30초 자동 임시저장 (제출 전 상태만)
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    if (submitted || locked || notOpen) return;
    const t = window.setInterval(() => { if (dirtyRef.current) saveRef.current("draft", true); }, 30000);
    return () => window.clearInterval(t);
  }, [submitted, locked, notOpen]);

  const trySubmit = () => {
    const e = validateContent(form, content, settings);
    setErrors(e);
    if (Object.keys(e).length) { toast("입력 기준을 확인해 주세요.", true); return; }
    setConfirm(true);
  };

  if (notOpen) return <div className="empty">{fmtDateTime(session.open_at)}에 열립니다.</div>;

  const readOnly = locked;
  const status = cell.status;
  return (
    <div className="stack s24">
      <div className="row between">
        <div className="row">
          <StatusChip status={status} overdue={cell.overdue} optional={rep} />
          {rep && <span className="chip line">대표급 · 선택 입력</span>}
          {cell.extended && <span className="chip acc">기한 연장됨</span>}
        </div>
        <span className="small faint">마감 {fmtDateTime(cell.due)} · {remaining(cell.due!)}</span>
      </div>

      {restored && <div className="banner info">저장되지 않았던 작성 내용을 이 기기에서 복구했습니다. 임시저장 또는 제출해 주세요.</div>}
      {!submitted && cell.overdue && !locked && <div className="banner warn">마감이 지났습니다. 지금 제출하면 '지연 제출'로 기록되며 수료에는 인정됩니다.</div>}
      {locked && submitted && <div className="banner info">마감되어 잠긴 제출물입니다. 수정이 필요하면 소속사 HR 담당자에게 잠금 해제를 요청하세요.</div>}
      {locked && !submitted && <div className="banner bad">최종 마감일({fmtFull(settings.final_deadline)})이 지나 제출할 수 없습니다. HR 담당자에게 문의하세요.</div>}
      {submitted && !locked && <div className="banner ok">제출 완료 ({fmtDateTime(sub?.submitted_at)}{sub?.is_late ? " · 지연" : ""}). 마감 전까지 수정 후 다시 제출할 수 있습니다.</div>}

      {readOnly ? <SubmissionView form={form} content={content} /> : (
        <div className="stack s24">
          {FORM_FIELDS[form].map((fd) => {
            if (fd.kind === "quotes") {
              const quotes = (content.quotes ?? emptyContent("pre").quotes) as { text: string; page: string }[];
              return (
                <div key={fd.key} className="field">
                  <span className="flabel">{fd.label}</span><span className="help">{fd.help}</span>
                  {quotes.map((q, i) => (
                    <div key={i} className="row nowrap quote-row" style={{ alignItems: "flex-start" }}>
                      <span className="chip acc" style={{ marginTop: 10 }}>{i + 1}</span>
                      <textarea style={{ minHeight: 64 }} value={q.text} placeholder={`인용구절 ${i + 1}`} aria-label={`인용구절 ${i + 1}`}
                        onChange={(e) => update({ ...content, quotes: quotes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                      <input type="text" style={{ width: 76 }} value={q.page} placeholder="쪽" aria-label={`인용구절 ${i + 1} 쪽수`} inputMode="numeric"
                        onChange={(e) => update({ ...content, quotes: quotes.map((x, j) => (j === i ? { ...x, page: e.target.value } : x)) })} />
                    </div>
                  ))}
                  {errors.quotes && <span className="err">{errors.quotes}</span>}
                </div>
              );
            }
            const v = String(content[fd.key] ?? "");
            const n = charLen(v);
            const min = fd.kind === "summary" ? settings.summary_min : settings.field_min;
            const max = fd.kind === "summary" ? settings.summary_max : null;
            const cls = n === 0 ? "" : n < min ? "warn" : max && n > max ? "bad" : "ok";
            return (
              <div key={fd.key} className="field">
                <div className="row between"><label htmlFor={fd.key}>{fd.label}</label>
                  <span className={`counter ${cls}`}>{n}자 {max ? `/ ${min}~${max}자` : `/ ${min}자 이상`}</span></div>
                <span className="help">{fd.help}</span>
                <textarea id={fd.key} value={v} aria-invalid={!!errors[fd.key]} style={{ minHeight: fd.kind === "summary" ? 200 : 130 }}
                  onChange={(e) => update({ ...content, [fd.key]: e.target.value })} />
                {errors[fd.key] && <span className="err">{errors[fd.key]}</span>}
              </div>
            );
          })}
          <div className="row between">
            <span className="tiny faint">{dirty ? "변경 내용 있음 · 30초마다 자동 임시저장" : savedAt ? `저장됨 ${fmtDateTime(savedAt)}` : "작성 전"}</span>
            <div className="btns">
              {!submitted && <button className="btn sec2" disabled={busy} onClick={() => save("draft")}>임시저장</button>}
              <button className="btn" disabled={busy || (submitted && !dirty)} onClick={trySubmit}>{submitted ? "수정 제출" : "제출"}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <Confirm title={`${FORM_LABEL[form]} ${submitted ? "수정 제출" : "제출"}`} okText="제출" onClose={() => setConfirm(false)}
          onOk={async () => { await save("submitted"); setConfirm(false); }}
          body={<div className="stack">
            {cell.overdue && !submitted && <div className="banner warn">마감 후 제출이므로 지연 제출로 기록됩니다.</div>}
            <SubmissionView form={form} content={content} />
            <p className="small muted">제출 후에도 마감({fmtDateTime(cell.due)}) 전까지는 수정할 수 있습니다.</p>
          </div>} />
      )}
    </div>
  );
}
