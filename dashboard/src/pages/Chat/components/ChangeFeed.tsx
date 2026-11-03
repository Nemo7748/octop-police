import { useTranslation } from "react-i18next";
import type { ChangeRecord } from "../workbenchTypes";
import styles from "../workbench.module.less";

interface ChangeFeedProps {
  readonly changes: readonly ChangeRecord[];
  readonly onOpenFile?: (path: string) => void;
}

export default function ChangeFeed({ changes, onOpenFile }: ChangeFeedProps) {
  const { t } = useTranslation();
  if (changes.length === 0) {
    return (
      <p className={styles.briefEmpty}>{t("policeWorkbench.brief.empty")}</p>
    );
  }
  return (
    <ul className={styles.changeFeed} data-testid="change-feed">
      {changes.map((change) => (
        <li key={change.callId} className={styles.changeItem}>
          <span className={styles.tag} data-active="false">
            {change.kind}
          </span>
          {onOpenFile ? (
            <button
              type="button"
              className={styles.fileLink}
              onClick={() => onOpenFile(change.path)}
              title={change.path}
            >
              {change.path}
            </button>
          ) : (
            <span className={styles.changePath} title={change.path}>
              {change.path}
            </span>
          )}
          {change.occurredAt ? (
            <time className={styles.changeTime} dateTime={change.occurredAt}>
              {change.occurredAt}
            </time>
          ) : (
            <span className={styles.changeTime}>
              {t("policeWorkbench.catalog.unknown")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
