import type { ReactNode } from "react";
import styles from "../workbench.module.less";

interface PoliceWorkbenchShellProps {
  readonly skillRail: ReactNode;
  readonly directory: ReactNode;
  readonly preview: ReactNode;
  readonly statusBar: ReactNode;
  readonly children: ReactNode;
}

export default function PoliceWorkbenchShell({
  skillRail,
  directory,
  preview,
  statusBar,
  children,
}: PoliceWorkbenchShellProps) {
  return (
    <div className={styles.shellColumn} data-testid="police-workbench-shell">
      <div className={styles.shell}>
        <div data-region="skill">{skillRail}</div>
        <div data-region="directory" className={styles.regionStretch}>
          {directory}
        </div>
        <main data-region="center" className={styles.center}>
          {children}
        </main>
        <div data-region="preview" className={styles.regionStretch}>
          {preview}
        </div>
      </div>
      {statusBar}
    </div>
  );
}
