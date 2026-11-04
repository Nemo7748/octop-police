import { useMemo } from "react";
import { Check, FileOutput, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkbenchPreviewController } from "../hooks/useWorkbenchPreview";
import type {
  PreviewDisplayStatus,
  ResourceState,
  TaskArtifactItem,
  WorkbenchContextKey,
} from "../workbenchTypes";
import { makeContextKey } from "../utils/workbenchContext";
import FilePanelContent from "./FilePanelContent";
import styles from "../workbench.module.less";

interface TaskResultPanelProps {
  readonly context: WorkbenchContextKey | null;
  readonly artifacts: ResourceState<readonly TaskArtifactItem[]>;
  readonly controller: WorkbenchPreviewController;
}

const STATUS_KEYS: Partial<Record<PreviewDisplayStatus, string>> = {
  generating: "generating",
  loading: "loading",
  updating: "updating",
  "read-failed": "failed",
  "render-failed": "renderFailed",
  unsupported: "unsupported",
  deleted: "deleted",
  forbidden: "forbidden",
};

export default function TaskResultPanel({
  context,
  artifacts,
  controller,
}: TaskResultPanelProps) {
  const { t } = useTranslation();
  const items = useMemo(
    () =>
      artifacts.status === "ready" || artifacts.status === "partial"
        ? artifacts.data
        : [],
    [artifacts],
  );
  const selection = controller.selection;
  const statusKey = STATUS_KEYS[controller.displayStatus];
  const selectedItem = items.find((item) => item.path === selection?.path);

  return (
    <section className={styles.resultPanel} aria-label={t("policeWorkbench.results.title", "生成产物")}>
      <header className={styles.resultHeader}>
        <div>
          <h2>{t("policeWorkbench.results.title", "生成产物")}</h2>
          <p>{t("policeWorkbench.results.count", "{{count}} 项产物", { count: items.length })}</p>
        </div>
        <button
          type="button"
          className={styles.followButton}
          data-active={controller.mode === "follow-latest"}
          onClick={controller.setFollowLatest}
          aria-pressed={controller.mode === "follow-latest"}
        >
          <Check size={14} aria-hidden />
          {t("policeWorkbench.results.followLatest", "跟随最新")}
        </button>
      </header>

      {controller.hasNewArtifact && (
        <button
          type="button"
          className={styles.newArtifactNotice}
          onClick={controller.setFollowLatest}
        >
          {t("policeWorkbench.preview.newArtifactAvailable", "有新产物可切换")}
        </button>
      )}

      <div className={styles.resultStatus} role="status">
        {statusKey
          ? t(`policeWorkbench.preview.${statusKey}`)
          : items.length === 0
            ? t("policeWorkbench.results.empty", "产物将在生成后显示")
            : controller.mode === "manual"
              ? t("policeWorkbench.results.manual", "手动预览")
              : t("policeWorkbench.results.following", "正在跟随最新产物")}
        {(controller.displayStatus === "read-failed" ||
          controller.displayStatus === "render-failed") && (
          <button type="button" onClick={controller.refresh}>
            <RotateCw size={13} aria-hidden />
            {t("policeWorkbench.preview.refresh", "刷新")}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <ul className={styles.resultList}>
          {items.map((item) => (
            <li key={`${item.contextKey}:${item.path}`}>
              <button
                type="button"
                className={styles.resultItem}
                data-selected={selection?.path === item.path}
                aria-current={selection?.path === item.path ? "true" : undefined}
                onClick={() => controller.open(item.path)}
                title={item.path}
              >
                <FileOutput size={16} aria-hidden />
                <span className={styles.resultItemText}>
                  <strong>{item.name}</strong>
                  <span>{item.path}</span>
                  <small>
                    {item.phase === "generating"
                      ? t("policeWorkbench.preview.generating", "产物正在生成")
                      : item.phase === "deleted"
                        ? t("policeWorkbench.preview.deleted", "该产物已删除或不可用")
                        : item.occurredAt
                          ? new Date(item.occurredAt).toLocaleString()
                          : t("policeWorkbench.results.timeUnknown", "时间未知")}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selection && context?.threadId && (
        <div className={styles.resultPreview}>
          <FilePanelContent
            agentId={context.agentId}
            contextKey={makeContextKey(context)}
            filePaths={items.map((item) => item.path)}
            selectedPath={selection.path}
            revision={selection.revision}
            displayStatus={controller.displayStatus}
            onSelectPath={controller.open}
            onRefresh={controller.refresh}
            onReadSuccess={controller.notifyReadSuccess}
            onReadFailure={controller.notifyReadFailure}
            onRenderFailure={controller.notifyRenderFailure}
            onUnsupported={controller.notifyUnsupported}
          />
        </div>
      )}
      {selectedItem?.phase === "deleted" && (
        <p className={styles.resultDeleted} role="alert">
          {t("policeWorkbench.preview.deleted", "该产物已删除或不可用")}
        </p>
      )}
    </section>
  );
}