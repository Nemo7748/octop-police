import { useTranslation } from "react-i18next";
import type { ComposerResourceSnapshot } from "../workbenchTypes";
import wbStyles from "../workbench.module.less";

interface PlanConfirmationCardProps {
  readonly goalText: string;
  readonly resources: ComposerResourceSnapshot;
  readonly stale: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export default function PlanConfirmationCard({
  goalText,
  resources,
  stale,
  onConfirm,
  onCancel,
}: PlanConfirmationCardProps) {
  const { t } = useTranslation();
  const resourceItems = [
    resources.roleAgentId
      ? `${t("policeWorkbench.composer.role")}: ${resources.roleAgentId}`
      : null,
    resources.model
      ? `${t("policeWorkbench.composer.model")}: ${resources.model}`
      : null,
    resources.skills.length > 0
      ? `${t("policeWorkbench.references.skills")}: ${resources.skills.join(
          ", ",
        )}`
      : null,
    resources.connectors.length > 0
      ? `${t(
          "policeWorkbench.references.connectors",
        )}: ${resources.connectors.join(", ")}`
      : null,
    resources.references.length > 0
      ? `${t("policeWorkbench.references.files")}: ${resources.references
          .map((reference) => reference.name)
          .join(", ")}`
      : null,
    resources.attachmentCount > 0
      ? `${t("policeWorkbench.references.files")}: ${resources.attachmentCount}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div
      className={`${wbStyles.card} ${wbStyles.planCard}`}
      data-testid="plan-confirmation-card"
      role="alertdialog"
      aria-label={t("policeWorkbench.plan.title")}
    >
      <h3 className={wbStyles.briefTitle}>{t("policeWorkbench.plan.title")}</h3>
      <section>
        <h4 className={wbStyles.briefSectionTitle}>
          {t("policeWorkbench.plan.goal")}
        </h4>
        <p className={wbStyles.planGoal}>
          {goalText.trim() || t("policeWorkbench.plan.noGoal")}
        </p>
      </section>
      <section>
        <h4 className={wbStyles.briefSectionTitle}>
          {t("policeWorkbench.plan.resources")}
        </h4>
        {resourceItems.length === 0 ? (
          <p className={wbStyles.briefEmpty}>
            {t("policeWorkbench.brief.empty")}
          </p>
        ) : (
          <ul className={wbStyles.briefList}>
            {resourceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>
      <p className={wbStyles.planWorkflow}>
        {t("policeWorkbench.plan.workflow")}
      </p>
      <p className={wbStyles.planNotice}>{t("policeWorkbench.plan.notice")}</p>
      {stale && (
        <p className={wbStyles.planStale} role="alert">
          {t("policeWorkbench.plan.stale")}
        </p>
      )}
      <div className={wbStyles.planActions}>
        <button
          type="button"
          className={wbStyles.planConfirm}
          disabled={stale}
          onClick={onConfirm}
        >
          {t("policeWorkbench.plan.confirm")}
        </button>
        <button
          type="button"
          className={wbStyles.planCancel}
          onClick={onCancel}
        >
          {t("policeWorkbench.plan.cancel")}
        </button>
      </div>
    </div>
  );
}
