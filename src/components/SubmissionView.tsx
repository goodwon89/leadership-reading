import { FORM_FIELDS } from "../lib/rules";
import type { FormType } from "../lib/types";

/** 제출물 본문 읽기 전용 표시 (참가자·관리자 공용) */
export default function SubmissionView({ form, content }: { form: FormType; content?: Record<string, any> | null }) {
  if (!content) return <p className="faint small">작성된 내용이 없습니다.</p>;
  return (
    <dl className="pres">
      {FORM_FIELDS[form].map((fd) => (
        <div key={fd.key}>
          <dt>{fd.label}</dt>
          {fd.kind === "quotes" ? (
            <dd className="stack s8" style={{ marginTop: 6 }}>
              {((content.quotes ?? []) as { text: string; page?: string }[]).filter((q) => q.text).map((q, i) => (
                <div key={i} className="quote">{q.text}{q.page ? <span className="faint small"> (p.{q.page})</span> : null}</div>
              ))}
            </dd>
          ) : <dd>{content[fd.key] || <span className="faint">-</span>}</dd>}
        </div>
      ))}
    </dl>
  );
}
