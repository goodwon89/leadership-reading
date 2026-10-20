import { Link } from "react-router-dom";
import { db, must } from "../../lib/supabase";
import { SAMPLES } from "../../lib/rules";
import { catLabel, type Book } from "../../lib/types";
import { Empty, Loading, PageHead, useAsync } from "../../components/ui";

// 근거: 인재경영실 「'27년도 리더십 2년차 교육(안)」 (2026.10.13) 1쪽 운영 안내 · 2쪽 별첨1 도서 목록 · 3쪽 연간 구성 예시
const OVERVIEW: [string, string][] = [
  ["일정", "2027년 1~12월 / 월 1회, 총 12회"],
  ["대상", "총 85명 (리더십 1년차 교육 대상자 중 '26년도 인사변동 반영)"],
  ["시간", "업무시간 내 운영"],
  ["직급별 운영", "대표급: 회의 종료 후 연계 진행 · 본부장·팀장급: 각 사별 일정 및 그룹 자율 편성"],
  ["도서 구성", "인문·경영 등 분야별 도서를 교차하여 운영 (총 12권)"],
];
const EFFECTS = ["자기 성찰과 사고의 깊이 확장", "직책자 경험 공유를 통한 관점의 다양성 확보", "구성원을 이해하고 이끄는 리더십 역량 강화", "조직 성장·협업 문화를 위한 인사이트 도출"];
const STEPS: { step: string; when: string; act: string; prep: string }[] = [
  { step: "사전학습", when: "교육 전", act: "당월 지정도서 완독", prep: "① 핵심 요약 300자 수준 ② 핵심 인용구절 3개" },
  { step: "발제·토론", when: "교육 중", act: "Facilitator 발제 및 참가자 전원 발표 · 핵심 안건·토론사항 논의", prep: "발표자료 사전 작성·공유 (느낀 점·시사점·현업 적용점 및 관점 공유)" },
  { step: "과제 제출", when: "교육 후", act: "토론 주제·인사이트 및 기대사항 정리 · 매 회차 종료 후 결과물 제출", prep: "각 사 HR 취합·관리 · 분기별(3개월) 인재경영실 제출·공유" },
];

export default function Guide() {
  const books = useAsync(() => must<Book[]>(db.from("books").select("*").order("no")), []);
  return (
    <div className="stack s32" style={{ maxWidth: 920 }}>
      <PageHead label="교육 안내" title="리더십 2년차 교육 운영 안내"
        desc="리더십 1년차('26년도 시행) 수료자의 지속적인 학습을 지원하고, 독서를 조직 차원의 학습문화로 확산하고자 합니다." />
      <p className="lead">상상인그룹 핵심가치 · 배움은 생존을 위한 가장 공격적인 투자다</p>

      <section className="stack">
        <h2>운영 개요</h2>
        <div className="tbl-wrap"><table><tbody>
          {OVERVIEW.map(([k, v]) => <tr key={k}><th style={{ width: 120, position: "static" }}>{k}</th><td>{v}</td></tr>)}
        </tbody></table></div>
      </section>

      <div className="grid g2">
        <section className="card stack">
          <h3>운영 Flow</h3>
          <div className="row" style={{ gap: 6 }}><span className="chip acc">지정도서 완독</span>›<span className="chip acc">인사이트 공유</span>›<span className="chip acc">과제 제출</span></div>
          <h3 style={{ marginTop: 8 }}>기대효과</h3>
          <ul className="stack s8" style={{ margin: 0, paddingLeft: 18 }}>{EFFECTS.map((e) => <li key={e}>{e}</li>)}</ul>
        </section>
        <section className="card stack">
          <h3>토론 예시 《실리콘밸리의 팀장들》</h3>
          <dl className="pres">
            <div><dt>진행자</dt><dd>토론 주제 발제</dd></div>
            <div><dt>참가자 전원</dt><dd>책에서 얻은 인사이트와 경험을 공유하며 개인·리더십·조직 관점으로 확장</dd></div>
          </dl>
        </section>
      </div>

      <section className="stack">
        <div className="row between"><h2>과제 제출</h2><span className="chip line">본부장·팀장급 해당</span></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>단계</th><th>주요 활동</th><th>준비·제출사항</th></tr></thead>
          <tbody>{STEPS.map((s) => <tr key={s.step}><td className="nowrap"><b>{s.step}</b><div className="tiny faint">{s.when}</div></td><td>{s.act}</td><td>{s.prep}</td></tr>)}</tbody>
        </table></div>
        <p className="small muted">플랫폼에서는 12회 × 3개 양식(사전학습·발표자료·과제) = 36건을 모두 제출하면 수료합니다. 대표급은 과제 제출 대상이 아니며 자유롭게 작성할 수 있습니다.</p>
        <Link to="/session" className="btn" style={{ alignSelf: "flex-start" }}>이번 회차 작성하기</Link>
      </section>

      <section className="stack">
        <h2>도서 목록 (총 12권)</h2>
        {books.loading ? <Loading /> : !books.data?.length ? <Empty>도서 정보를 불러오지 못했습니다.</Empty> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th className="r">No.</th><th>분야</th><th>도서명</th><th>저자</th><th>핵심 내용</th><th>비고</th></tr></thead>
            <tbody>{books.data.map((b) => (
              <tr key={b.id}><td className="r">{b.no}</td><td className="nowrap">{catLabel(b.category)}</td><td style={{ minWidth: 160 }}><b>{b.title}</b></td><td className="nowrap small">{b.author}</td><td className="small" style={{ minWidth: 240 }}>{b.summary}</td>
                <td className="small" style={{ minWidth: 110 }}>{b.recommended_by ? <span className="chip acc" style={{ whiteSpace: "normal" }}>{b.recommended_by}</span> : <span className="faint">-</span>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="stack">
        <h2>연간 도서 구성 예시</h2>
        <p className="small muted">아래 3가지는 예시이며, 각 사의 운영 목적과 상황에 맞게 순서를 자율적으로 편성합니다. 인문 도서와 경제·경영 도서를 균형 있게 교차 배치하는 것을 권장합니다.</p>
        <div className="grid g3">
          {SAMPLES.map((s) => (
            <div key={s.key} className="card tight stack s8">
              <b>{s.name}</b><span className="tiny faint">{s.desc}</span>
              <ol className="small" style={{ margin: 0, paddingLeft: 22 }}>
                {s.order.map((id, i) => <li key={i}>{books.data?.find((b) => b.id === id)?.title ?? "-"}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
