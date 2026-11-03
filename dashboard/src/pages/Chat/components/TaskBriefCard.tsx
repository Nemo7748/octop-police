import { useTranslation } from "react-i18next";
import type { ResourceState, TaskBrief } from "../workbenchTypes";
import styles from "../workbench.module.less";

interface TaskBriefCardProps {
  readonly brief: ResourceState<TaskBrief>;
}

function BriefSection({
  title,
  items,
  emptyText,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly emptyText: string;
}) {
  return (
    <section className={styles.briefSection}>
      <h4 className={styles.briefSectionTitle}>{title}</h4>
      {items.length === 0 ? (
        <p className={styles.briefEmpty}>{emptyText}</p>
      ) : (
        <ul className={styles.briefList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TaskBriefCard({ brief }: TaskBriefCardProps) {
  const { t } = useTranslation();
  const emptyText = t("policeWorkbench.brief.empty");
  const data = brief.status === "ready" ? brief.data : null;
  return (
    <div
      className={`${styles.card} ${styles.briefCard}`}
      data-testid="task-brief-card"
    >
      <h3 className={styles.briefTitle}>{t("policeWorkbench.brief.title")}</h3>
      {brief.status === "loading" || brief.status === "idle" ? (
        <p className={styles.briefEmpty}>
          {t("policeWorkbench.preview.loading")}
        </p>
      ) : brief.status === "error" ? (
        <p className={styles.briefEmpty}>
          {t("policeWorkbench.catalog.notAvailable")}
        </p>
      ) : (
        <div className={styles.briefGrid}>
          <BriefSection
            title={t("policeWorkbench.brief.delivered")}
            items={data?.delivered ?? []}
            emptyText={emptyText}
          />
          <BriefSection
            title={t("policeWorkbench.brief.nextSteps")}
            items={data?.nextSteps ?? []}
            emptyText={emptyText}
          />
          <BriefSection
            title={t("policeWorkbench.brief.materials")}
            items={data?.requiredMaterials ?? []}
            emptyText={emptyText}
          />
        </div>
      )}
    </div>
  );
}
