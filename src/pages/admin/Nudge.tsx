import { useState } from "react";
import { callFn, DEMO, errMsg } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { Modal, useToast } from "../../components/ui";

/** 수동 독려 메일 (스펙 8장 '수동 독려') */
export default function NudgeModal({ people, subject: s0, message: m0, sessionId, onClose }: { people: Profile[]; subject: string; message: string; sessionId?: string; onClose: () => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set(people.map((p) => p.id)));
  const [subject, setSubject] = useState(s0);
  const [message, setMessage] = useState(m0);
  const [busy, setBusy] = useState(false);
  const noMail = people.filter((p) => !p.notify_email);
  const send = async () => {
    setBusy(true);
    try {
      const r = await callFn<{ sent: number; skipped: number; failed: number }>("notify", { mode: "manual", profile_ids: [...sel], subject, message, session_id: sessionId });
      toast(DEMO ? `데모: ${r.skipped}명에게 발송 기록만 남겼습니다.` : `발송 ${r.sent}건${r.skipped ? ` · 제외 ${r.skipped}` : ""}${r.failed ? ` · 실패 ${r.failed}` : ""}`);
      onClose();
    } catch (e) { toast(errMsg(e), true); } finally { setBusy(false); }
  };
  return (
    <Modal title="독려 메일 보내기" wide onClose={onClose} footer={<><button className="btn line" onClick={onClose}>취소</button><button className="btn" disabled={busy || !sel.size} onClick={send}>{busy ? "발송 중…" : `${sel.size}명에게 발송`}</button></>}>
      <div className="stack">
        <div className="field"><label>받는 사람 ({sel.size}/{people.length})</label>
          <div className="row" style={{ gap: 6, maxHeight: 140, overflow: "auto" }}>
            {people.map((p) => (
              <label key={p.id} className={`chip ${sel.has(p.id) ? "acc" : "line"}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" className="hidden" checked={sel.has(p.id)} onChange={() => { const n = new Set(sel); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSel(n); }} />
                {p.name}{!p.notify_email && " (메일 없음)"}
              </label>
            ))}
          </div>
          {noMail.length > 0 && <span className="help">메일 주소가 없는 {noMail.length}명은 발송에서 제외됩니다.</span>}
        </div>
        <div className="field"><label>제목</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="field"><label>본문</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 160 }} /><span className="help">{"{name}"} 은 받는 사람 이름으로 바뀝니다. 메일 하단에 플랫폼 바로가기 버튼이 붙습니다.</span></div>
      </div>
    </Modal>
  );
}
