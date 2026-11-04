import { Component, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";

interface Props extends WithTranslation {
  readonly children: ReactNode;
  readonly sourceText?: string;
  readonly onError?: () => void;
}

interface State {
  readonly hasError: boolean;
}

class MarkdownErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  componentDidUpdate(previousProps: Props): void {
    if (
      this.state.hasError &&
      previousProps.sourceText !== this.props.sourceText
    ) {
      this.setState({ hasError: false });
    }
  }

  private readonly retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" data-testid="markdown-error-fallback">
          <p>{this.props.t("policeWorkbench.preview.renderFailed")}</p>
          <button type="button" onClick={this.retry}>
            {this.props.t("policeWorkbench.preview.refresh")}
          </button>
          {this.props.sourceText !== undefined && (
            <pre>{this.props.sourceText}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const MarkdownErrorBoundary = withTranslation()(MarkdownErrorBoundaryInner);
export default MarkdownErrorBoundary;
