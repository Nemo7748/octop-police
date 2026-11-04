import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PoliceWorkbenchShell from "./PoliceWorkbenchShell";
import { useWorkbenchLayout } from "../hooks/useWorkbenchLayout";
import { useWorkbenchUi } from "../hooks/useWorkbenchUi";
import styles from "../workbench.module.less";

interface PoliceWorkbenchRouteFallbackProps {
  readonly skillRail: ReactNode;
}

function LoadingRegion({ label }: { readonly label: string }) {
  return (
    <div className={styles.fallbackRegion} role="status" aria-label={label}>
      <span className={styles.fallbackLine} />
      <span className={styles.fallbackLine} />
      <span className={styles.fallbackLineShort} />
    </div>
  );
}

export default function PoliceWorkbenchRouteFallback({
  skillRail,
}: PoliceWorkbenchRouteFallbackProps) {
  const { t } = useTranslation();
  const layout = useWorkbenchLayout();
  const { activeAuxPanel, setActiveAuxPanel } = useWorkbenchUi(layout);
  const loading = t("common.loading", "加载中");

  return (
    <PoliceWorkbenchShell
      skillRail={skillRail}
      directory={<LoadingRegion label={loading} />}
      preview={<LoadingRegion label={loading} />}
      statusBar={null}
      layout={layout}
      activeAuxPanel={activeAuxPanel}
      onAuxPanelChange={setActiveAuxPanel}
    >
      <LoadingRegion label={loading} />
    </PoliceWorkbenchShell>
  );
}