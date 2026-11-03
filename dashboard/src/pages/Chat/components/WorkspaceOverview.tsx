import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { workspaceApi } from "../../../api/modules/workspace";
import { useWorkspaceIndex } from "../hooks/useWorkspaceIndex";
import { useTaskArtifacts } from "../hooks/useTaskArtifacts";
import type { WorkbenchContextKey, WorkspaceArtifact } from "../workbenchTypes";
import { stateCount } from "../utils/workbenchContext";
import type { WorkbenchBusinessTag } from "../hooks/useWorkbenchUi";
import TaskBriefCard from "./TaskBriefCard";
import ChangeFeed from "./ChangeFeed";
import styles from "../workbench.module.less";

interface WorkspaceOverviewProps {
  readonly agentId: string | null;
  readonly context: WorkbenchContextKey | null;
  readonly businessTag: WorkbenchBusinessTag | null;
  readonly onBusinessTagChange: (tag: WorkbenchBusinessTag | null) => void;
  readonly onOpenFile: (path: string) => void;

}


const BUSINESS_TAGS: readonly WorkbenchBusinessTag[] = [
  "office",
  "coding",
  "design",
];

export default function WorkspaceOverview({
  agentId,
  context,
  businessTag,
  onBusinessTagChange,
  onOpenFile,

}: WorkspaceOverviewProps) {
  const { t } = useTranslation();

  const workspace = useWorkspaceIndex({ agentId, enabled: Boolean(agentId) });
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState<
    "artifacts" | "changes" | null
  >(null);
  const readmePath = workspace.defaultReadme?.path ?? null;
  const contextKey = context
    ? `${context.agentId}:${context.threadId ?? ""}`
    : "";

  useEffect(() => {
    setExpandedView(null);
    setReadmeContent(null);
  }, [contextKey, agentId]);

  useEffect(() => {
    if (!agentId || !readmePath) return;
    let cancelled = false;
    workspaceApi
      .readAgentFile(agentId, readmePath)
      .then((file) => {
        if (!cancelled) setReadmeContent(file.content);
      })
      .catch(() => {
        if (!cancelled) setReadmeContent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, readmePath]);

  const task = useTaskArtifacts(context, readmeContent);


  const files: readonly WorkspaceArtifact[] =
    workspace.state.status === "ready" ? workspace.state.data : [];
  const changeCount = stateCount(task.changes);
  const artifactCount = stateCount(workspace.state);

  return (
    <div className={styles.overview} data-testid="workspace-overview">
      <div className={styles.tagRow} role="group" aria-label="business tags">
        {BUSINESS_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={styles.tag}
            data-active={businessTag === tag}
            aria-pressed={businessTag === tag}
            onClick={() =>
              onBusinessTagChange(businessTag === tag ? null : tag)
            }
          >
            {t(`policeWorkbench.tags.${tag}`)}
          </button>
        ))}
      </div>

      <TaskBriefCard brief={task.brief} />

      <div className={`${styles.card} ${styles.fileCard}`}>
        <div className={styles.fileCardHeader}>
          <h3 className={styles.briefTitle}>
            {t("policeWorkbench.overview.artifactsTitle")}
          </h3>
          <div className={styles.fileCardActions}>
            <button
              type="button"
              className={styles.fileLink}
              onClick={() =>
                setExpandedView((prev) =>
                  prev === "artifacts" ? null : "artifacts",
                )
              }
            >
              {artifactCount === null
                ? t("policeWorkbench.overview.statsIncomplete")
                : t("policeWorkbench.overview.viewAllArtifacts", {
                    count: artifactCount,
                  })}
            </button>
            <button
              type="button"
              className={styles.fileLink}
              onClick={() =>
                setExpandedView((prev) =>
                  prev === "changes" ? null : "changes",
                )
              }
            >
              {changeCount === null
                ? t("policeWorkbench.overview.statsIncomplete")
                : t("policeWorkbench.overview.viewAllChanges", {
                    count: changeCount,
                  })}
            </button>
          </div>
        </div>

        {workspace.state.status === "loading" ||
        workspace.state.status === "idle" ? (
          <p className={styles.briefEmpty}>
            {t("policeWorkbench.preview.loading")}
          </p>
        ) : workspace.state.status === "error" ? (
          <div className={styles.errorRow}>
            <span>{t("policeWorkbench.catalog.loadFailed")}</span>
            <button
              type="button"
              className={styles.fileLink}
              onClick={() => void workspace.refresh()}
            >
              {t("policeWorkbench.catalog.retry")}
            </button>
          </div>
        ) : files.length === 0 ? (
          <p className={styles.briefEmpty}>
            {t("policeWorkbench.brief.empty")}
          </p>
        ) : (
          <ul className={styles.fileList}>
            {(expandedView === "artifacts" ? files : files.slice(0, 8)).map(
              (file) => (
                <li key={file.path}>
                  <button
                    type="button"
                    className={styles.fileLink}
                    title={file.path}
                    onClick={() => onOpenFile(file.path)}
                  >
                    {file.name}
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        {expandedView === "changes" &&
          (task.changes.status === "ready" ||
          task.changes.status === "partial" ? (
            <>
              {task.changes.status === "partial" && (
                <p className={styles.briefEmpty}>
                  {t("policeWorkbench.overview.statsIncomplete")}
                </p>
              )}
              <ChangeFeed changes={task.changes.data} onOpenFile={onOpenFile} />
            </>
          ) : task.changes.status === "idle" ? (
            <p className={styles.briefEmpty}>
              {t("policeWorkbench.overview.noTaskChanges")}
            </p>
          ) : task.changes.status === "error" ? (
            <p className={styles.briefEmpty}>
              {t("policeWorkbench.catalog.notAvailable")}
            </p>
          ) : (
            <p className={styles.briefEmpty}>
              {t("policeWorkbench.preview.loading")}
            </p>
          ))}
      </div>
    </div>
  );
}
