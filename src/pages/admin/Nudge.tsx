import { useState } from "react";
import type { Profile } from "../../lib/types";
import { Modal, useToast } from "../../components/ui";

/** 독려 안내 만들기 — 플랫폼은 메일을 보내지 않음. 관리자가 사내 메일(Outlook)·메신저에 붙여넣어 직접 보냄 */
export default function NudgeModal({ people, subject: s0, message: m0, onClose }: { people: Profile[]; subject: string; message: string; sessionId?: string; onClose: () => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set(people.map((p) => p.id)));
  const [subject, setSubject] = useState(s0);
  const [message, setMessage] = useState(m0.replace(/\{name\}님,?\s*/g, "").replace(/\{name\}/g, ""));
  const chosen = people.filter((p) => sel.has(p.id));
  const link = `${location.origin}${location.pathname}`;
  const body = `${message}\n\n▶ 바로가기: ${link}`;
  // Outlook 받는 사람 칸에 붙여넣으면 사내 주소록에서 이름으로 찾아짐
  const names = chosen.map((p) => p.name).join("; ");
  const roster = chosen.map((p) => `${p.name} (${p.emp_no}${p.department ? ` · ${p.department}` : ""})`).join("\n");
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} 복사했습니다.`); }
    catch { toast("복사하지 못했습니다. 직접 선택해 복사해 주세요.", true); }
  };
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <Modal title="독려 안내 만들기" wide onClose={onClose} footer={<>
      <button className="btn line" onClick={onClose}>닫기</button>
      <a className="btn" href={mailto} onClick={() => { if (chosen.length) copy(names, "받는 사람 이름을"); }}>Outlook에서 메일 쓰기</a>
    </>}>
      <div className="stack">
        <div className="banner info"><span>이 플랫폼은 메일을 직접 보내지 않습니다. 아래 명단과 안내문을 <b>사내 메일(Outlook)이나 메신저</b>에 붙여넣어 보내 주세요. 'Outlook에서 메일 쓰기'를 누르면 제목·본문이 채워진 새 메일이 열리고, 받는 사람 이름이 복사되어 받는 사람 칸에 붙여넣을 수 있습니다.</span></div>
        <div className="field"><label>대상 ({sel.size}/{people.length})</label>
          <div className="row" style={{ gap: 6, maxHeight: 140, overflow: "auto" }}>
            {people.map((p) => (
              <label key={p.id} className={`chip ${sel.has(p.id) ? "acc" : "line"}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" className="hidden" checked={sel.has(p.id)} onChange={() => { const n = new Set(sel); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSel(n); }} />
                {p.name}
              </label>
            ))}
          </div>
          <div className="btns" style={{ marginTop: 6 }}>
            <button className="btn xs line" disabled={!chosen.length} onClick={() => copy(names, "받는 사람 이름을")}>이름 복사 (Outlook 받는 사람용)</button>
            <button className="btn xs line" disabled={!chosen.length} onClick={() => copy(roster, "명단을")}>명단 복사 (이름·사번·부서)</button>
          </div>
        </div>
        <div className="field"><label>제목</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="field"><label>안내문</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 160 }} />
          <span className="help">끝에 플랫폼 바로가기 주소가 붙습니다.</span></div>
        <div className="btns"><button className="btn sm line" onClick={() => copy(`${subject}\n\n${body}`, "제목과 안내문을")}>제목·안내문 복사</button></div>
      </div>
    </Modal>
  );
}
