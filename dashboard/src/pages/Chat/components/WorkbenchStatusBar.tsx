import { useTranslation } from "react-i18next";
import EnvironmentBadge from "./EnvironmentBadge";
import styles from "../workbench.module.less";

export default function WorkbenchStatusBar() {
  const { t } = useTranslation();
  return (
    <footer className={styles.statusBar} data-testid="workbench-status-bar">
      <EnvironmentBadge />
      <span>{t("policeWorkbench.footer.copyright")}</span>
    </footer>
  );
}
