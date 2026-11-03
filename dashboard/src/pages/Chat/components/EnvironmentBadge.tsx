import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { probeHealth } from "../../../api/probeHealth";
import { resolveDeploymentKind } from "../utils/environment";
import styles from "../workbench.module.less";

type HealthState = "checking" | "online" | "offline";

export default function EnvironmentBadge() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthState>("checking");
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    setHealth("checking");
    const result = await probeHealth();
    if (!mountedRef.current) return;
    setHealth(result.ok ? "online" : "offline");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void check();
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  const deployment = resolveDeploymentKind(window.location.hostname);
  const deploymentLabel =
    deployment === "local"
      ? t("policeWorkbench.environment.local")
      : t("policeWorkbench.environment.unknown");
  const healthLabel =
    health === "online"
      ? t("policeWorkbench.environment.connected")
      : health === "offline"
      ? t("policeWorkbench.environment.disconnected")
      : t("policeWorkbench.catalog.unknown");
  const retryable = health === "offline";

  return (
    <button
      type="button"
      className={styles.environmentBadge}
      data-retryable={retryable}
      data-health={health}
      aria-label={`${deploymentLabel} · ${healthLabel}`}
      title={retryable ? t("policeWorkbench.environment.retry") : healthLabel}
      onClick={() => {
        if (retryable) void check();
      }}
    >
      <span
        className={styles.statusDot}
        data-state={
          health === "online"
            ? "online"
            : health === "offline"
            ? "offline"
            : "checking"
        }
        aria-hidden
      />
      <span>{deploymentLabel}</span>
      <span aria-hidden>·</span>
      <span>{healthLabel}</span>
    </button>
  );
}
