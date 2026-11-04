import { Component, type ReactNode } from "react";
import { Button, Result } from "antd";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  isPoliceWorkbenchPath,
  resolvePoliceCapability,
} from "../routes/policeCapabilities";
import { workbenchDiagnostics } from "../utils/workbenchDiagnostics";

export type PoliceRouteStatus =
  | "unavailable"
  | "forbidden"
  | "context-required"
  | "load-failed";

interface PoliceRouteResultProps {
  readonly status: PoliceRouteStatus;
  readonly onRetry?: () => void;
}

function PoliceRouteResult({ status, onRetry }: PoliceRouteResultProps) {
  const { t } = useTranslation();
  const titleKey = {
    unavailable: "capabilityUnavailable",
    forbidden: "forbidden",
    "context-required": "contextRequired",
    "load-failed": "pageLoadFailed",
  }[status];
  const resultStatus = {
    unavailable: "404",
    forbidden: "403",
    "context-required": "info",
    "load-failed": "error",
  }[status] as "404" | "403" | "info" | "error";

  return (
    <div
      data-testid={`police-route-${status}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: 240,
      }}
    >
      <Result
        status={resultStatus}
        title={t(`policeWorkbench.navigation.${titleKey}`)}
        extra={
          status === "load-failed" && onRetry ? (
            <Button type="primary" onClick={onRetry}>
              {t("policeWorkbench.navigation.retry")}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

interface RouteErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError: () => void;
}

interface RouteErrorBoundaryState {
  readonly hasError: boolean;
}

class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <PoliceRouteResult
          status="load-failed"
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}

interface PoliceRouteBoundaryProps {
  readonly children?: ReactNode;
  readonly status?: Exclude<PoliceRouteStatus, "load-failed">;
}

export default function PoliceRouteBoundary({
  children,
  status,
}: PoliceRouteBoundaryProps) {
  const location = useLocation();
  if (status) return <PoliceRouteResult status={status} />;

  return (
    <RouteErrorBoundary
      key={
        isPoliceWorkbenchPath(location.pathname) ? "workbench" : location.pathname
      }
      onError={() => {
        workbenchDiagnostics.navigation({
          sourceEntry: "route.boundary",
          capabilityId:
            resolvePoliceCapability(location.pathname)?.capabilityId ??
            "unknown",
          result: "load-failed",
          reason: "render-error",
        });
      }}
    >
      {children}
    </RouteErrorBoundary>
  );
}