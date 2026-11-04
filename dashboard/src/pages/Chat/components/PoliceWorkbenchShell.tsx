import type { ReactNode } from "react";
import { Drawer } from "antd";
import { Files, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  deriveLayout,
  type WorkbenchLayout,
} from "../hooks/useWorkbenchLayout";
import type { WorkbenchPanelId } from "../hooks/useWorkbenchUi";
import styles from "../workbench.module.less";

interface PoliceWorkbenchShellProps {
  readonly skillRail: ReactNode;
  readonly directory: ReactNode;
  readonly preview: ReactNode;
  readonly statusBar: ReactNode;
  readonly children: ReactNode;
  readonly layout?: WorkbenchLayout;
  readonly activeAuxPanel?: WorkbenchPanelId | null;
  readonly onAuxPanelChange?: (panel: WorkbenchPanelId | null) => void;
}

export default function PoliceWorkbenchShell({
  skillRail,
  directory,
  preview,
  statusBar,
  children,
  layout = deriveLayout("wide"),
  activeAuxPanel = null,
  onAuxPanelChange = () => undefined,
}: PoliceWorkbenchShellProps) {
  const { t } = useTranslation();
  const directoryTitle = t("policeWorkbench.task.navigation", "任务导航");
  const previewTitle = t("policeWorkbench.results.title", "生成产物");

  return (
    <div className={styles.shellColumn} data-testid="police-workbench-shell">
      <div className={styles.shell} data-breakpoint={layout.breakpoint}>
        <div data-region="skill">{skillRail}</div>
        {layout.isWide && (
          <div
            data-region="directory"
            className={`${styles.regionStretch} ${styles.directoryPane}`}
          >
            {directory}
          </div>
        )}
        <main data-region="center" className={styles.center}>
          {!layout.isWide && (
            <div className={styles.auxToolbar} aria-label={directoryTitle}>
              <button
                type="button"
                className={styles.auxTrigger}
                aria-expanded={activeAuxPanel === "directory"}
                aria-controls="workbench-directory-drawer"
                onClick={() =>
                  onAuxPanelChange(
                    activeAuxPanel === "directory" ? null : "directory",
                  )
                }
              >
                <PanelLeftOpen size={16} aria-hidden />
                <span>{directoryTitle}</span>
              </button>
              <button
                type="button"
                className={styles.auxTrigger}
                aria-expanded={activeAuxPanel === "preview"}
                aria-controls="workbench-preview-drawer"
                onClick={() =>
                  onAuxPanelChange(
                    activeAuxPanel === "preview" ? null : "preview",
                  )
                }
              >
                <Files size={16} aria-hidden />
                <span>{previewTitle}</span>
              </button>
            </div>
          )}
          <div className={styles.centerContent}>{children}</div>
        </main>
        {layout.isWide && (
          <div
            data-region="preview"
            className={`${styles.regionStretch} ${styles.previewPane}`}
          >
            {preview}
          </div>
        )}
      </div>
      {statusBar}
      {!layout.isWide && (
        <>
          <Drawer
            title={directoryTitle}
            open={activeAuxPanel === "directory"}
            onClose={() => onAuxPanelChange(null)}
            placement="left"
            width="min(360px, 92vw)"
            className={styles.workbenchDrawer}
            styles={{ body: { padding: 0, display: "flex", minHeight: 0 } }}
          >
            <div
              id="workbench-directory-drawer"
              className={styles.drawerRegion}
              data-region="directory"
            >
              {directory}
            </div>
          </Drawer>
          <Drawer
            title={previewTitle}
            open={activeAuxPanel === "preview"}
            onClose={() => onAuxPanelChange(null)}
            placement="right"
            width="min(420px, 92vw)"
            className={styles.workbenchDrawer}
            styles={{ body: { padding: 0, display: "flex", minHeight: 0 } }}
          >
            <div
              id="workbench-preview-drawer"
              className={styles.drawerRegion}
              data-region="preview"
            >
              {preview}
            </div>
          </Drawer>
        </>
      )}
    </div>
  );
}
