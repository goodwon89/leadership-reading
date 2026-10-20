import { Component, ReactNode } from "react";
import { logError } from "../lib/errlog";

/** 화면 일부에서 오류가 나도 빈 화면 대신 안내를 보여 줌 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError(error.message, `${error.stack ?? ""}\n${info.componentStack ?? ""}`);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="wrap" style={{ maxWidth: 520, paddingTop: 72 }}>
        <div className="card stack">
          <span className="label">일시적인 오류</span>
          <h2>화면을 표시하지 못했어요</h2>
          <p className="muted">작성 중이던 내용은 이 기기에 임시로 보관되어 있어요. 새로고침하면 대부분 해결됩니다. 계속 같은 화면이 나오면 소속사 HR 담당자에게 알려 주세요.</p>
          <p className="tiny faint">오류 내용: {this.state.error.message.slice(0, 160)}</p>
          <div className="btns">
            <button className="btn" onClick={() => { try { location.reload(); } catch { this.setState({ error: null }); } }}>새로고침</button>
            <button className="btn line" onClick={() => { this.setState({ error: null }); location.hash = "#/"; }}>홈으로</button>
          </div>
        </div>
      </main>
    );
  }
}
