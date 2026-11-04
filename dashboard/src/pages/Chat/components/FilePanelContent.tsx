import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Select, message, Tooltip, Segmented } from "antd";
import { Pencil, Save, ArrowDownToLine, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { workspaceApi } from "../../../api/modules/workspace";
import FileViewer from "../../Agent/Workspace/components/FileViewer";
import type { FileViewerLoadStatus } from "../../Agent/Workspace/components/previewLoadState";
import { getDocKind } from "../../Agent/Workspace/utils/docKind";
import { getMediaKind } from "../../Agent/Workspace/utils/mediaKind";
import { isProbablyText } from "../../Agent/Workspace/utils/fileKind";
import {
  getPreviewKind,
  previewNeedsFillLayout,
  defaultPreviewMode,
} from "../../Agent/Workspace/components/FilePreview";
import type {
  PreviewDisplayStatus,
  PreviewRequestToken,
  ResourceError,
} from "../workbenchTypes";
import { mapApiErrorKind } from "../utils/workbenchContext";
import styles from "../index.module.less";

function panelFilePath(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("file://")) {
    let abs = trimmed.slice("file://".length);
    if (abs.startsWith("//")) abs = abs.slice(1);
    return abs.startsWith("/") || /^[A-Za-z]:/.test(abs) ? abs : `/${abs}`;
  }
  return trimmed;
}

interface ContentSnapshot {
  readonly contextKey: string;
  readonly path: string;
  readonly content: string;
}

interface FilePanelContentProps {
  readonly agentId: string;
  readonly filePaths: readonly string[];
  readonly initialPath?: string | null;
  readonly revision?: number;
  readonly contextKey?: string;
  readonly selectedPath?: string | null;
  readonly displayStatus?: PreviewDisplayStatus;
  readonly onSelectPath?: (path: string) => void;
  readonly onRefresh?: () => void;
  readonly onReadSuccess?: (token: PreviewRequestToken) => void;
  readonly onReadFailure?: (
    token: PreviewRequestToken,
    error: ResourceError,
  ) => void;
  readonly onRenderFailure?: (token: PreviewRequestToken) => void;
  readonly onUnsupported?: (token: PreviewRequestToken) => void;
}

export default function FilePanelContent({
  agentId,
  filePaths,
  initialPath,
  revision = 0,
  contextKey,
  selectedPath: controlledPath,
  onSelectPath,
  onRefresh,
  onReadSuccess,
  onReadFailure,
  onRenderFailure,
  onUnsupported,
}: FilePanelContentProps) {
  const { t } = useTranslation();
  const normalizedPaths = useMemo(
    () => filePaths.map((path) => panelFilePath(path)),
    [filePaths],
  );
  const normalizedInitial = initialPath ? panelFilePath(initialPath) : null;
  const [internalPath, setInternalPath] = useState("");
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [readFailed, setReadFailed] = useState(false);

  useEffect(() => {
    if (controlledPath === undefined && normalizedInitial) {
      setInternalPath(normalizedInitial);
    }
  }, [controlledPath, normalizedInitial]);

  const resolvedPath =
    controlledPath !== undefined
      ? (controlledPath ?? "")
      : internalPath ||
        normalizedInitial ||
        normalizedPaths[normalizedPaths.length - 1] ||
        "";
  const currentContextKey = contextKey ?? agentId;
  const content =
    snapshot?.contextKey === currentContextKey && snapshot.path === resolvedPath
      ? snapshot.content
      : "";
  const hasCurrentContent = content !== "";

  const docKind = resolvedPath ? getDocKind(resolvedPath) : null;
  const mediaKind = resolvedPath ? getMediaKind(resolvedPath) : null;
  const previewKind = resolvedPath ? getPreviewKind(resolvedPath) : null;
  const isText = resolvedPath ? isProbablyText(resolvedPath) : false;
  const showPreviewToggle =
    isText && previewKind !== null && !editMode && hasCurrentContent;

  const apiFilePath = useMemo(() => {
    if (resolvedPath.startsWith("/") || /^[A-Za-z]:/.test(resolvedPath)) {
      return `file://${resolvedPath}`;
    }
    return resolvedPath;
  }, [resolvedPath]);

  useEffect(() => {
    if (!resolvedPath || !agentId) return;
    setEditMode(false);
    setPreviewMode(defaultPreviewMode(resolvedPath));
    setReadFailed(false);
    const token = { contextKey: currentContextKey, path: resolvedPath, revision };
    if (!isText) {
      setFileLoading(false);
      if (!mediaKind && (!docKind || docKind === "ppt")) onUnsupported?.(token);
      return;
    }

    const abortController = new AbortController();
    setFileLoading(true);
    workspaceApi
      .readAgentFile(agentId, apiFilePath, {
        signal: abortController.signal,
      })
      .then((response) => {
        if (abortController.signal.aborted) return;
        setSnapshot({
          contextKey: currentContextKey,
          path: resolvedPath,
          content: response.content,
        });
        setReadFailed(false);
        onReadSuccess?.(token);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        const kind = mapApiErrorKind(error);
        setReadFailed(true);
        if (kind === "forbidden" || kind === "unauthorized" || kind === "unavailable") {
          setSnapshot(null);
        }
        onReadFailure?.(token, {
          kind,
          message: "",
          retryable: kind === "unknown",
        });
      })
      .finally(() => {
        if (!abortController.signal.aborted) setFileLoading(false);
      });

    return () => abortController.abort();
  }, [
    resolvedPath,
    apiFilePath,
    agentId,
    currentContextKey,
    isText,
    mediaKind,
    docKind,
    refreshToken,
    revision,
    onReadSuccess,
    onReadFailure,
    onUnsupported,
    t,
  ]);

  const refresh = useCallback(() => {
    setEditMode(false);
    if (onRefresh) onRefresh();
    else setRefreshToken((value) => value + 1);
  }, [onRefresh]);

  const save = async () => {
    if (!resolvedPath) return;
    setSaving(true);
    try {
      await request(
        `/agents/${agentId}/workspace/file?path=${encodeURIComponent(apiFilePath)}`,
        { method: "PUT", body: JSON.stringify({ content }) },
      );
      message.success(t("workspace.saved", "已保存"));
      setEditMode(false);
    } catch {
      message.error(t("workspace.saveFailed", "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!resolvedPath) return;
    try {
      const blob = await workspaceApi.downloadAgentFile(agentId, apiFilePath);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resolvedPath.split("/").pop() || "download";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error(t("workspace.downloadFailed", "下载失败"));
    }
  };

  const handleViewerState = useCallback(
    (state: FileViewerLoadStatus) => {
      if (!resolvedPath) return;
      const token = { contextKey: currentContextKey, path: resolvedPath, revision };
      if (state.status === "ready") onReadSuccess?.(token);
      if (state.status === "read-failed") onReadFailure?.(token, state.error);
      if (state.status === "render-failed") onRenderFailure?.(token);
      if (state.status === "unsupported") onUnsupported?.(token);
    },
    [
      currentContextKey,
      resolvedPath,
      revision,
      onReadSuccess,
      onReadFailure,
      onRenderFailure,
      onUnsupported,
    ],
  );

  const bodyFill =
    editMode ||
    docKind !== null ||
    (previewMode && previewNeedsFillLayout(previewKind));

  return (
    <div className={styles.filePanelBody}>
      <div className={styles.fileModalToolbar}>
        <div className={styles.fileModalToolbarLeft}>
          {normalizedPaths.length > 1 && (
            <Select
              size="small"
              value={resolvedPath || undefined}
              onChange={(path) => {
                if (onSelectPath) onSelectPath(path);
                else setInternalPath(path);
              }}
              className={styles.fileModalSelect}
              aria-label={t("chat.fileSwitch", "切换文件")}
              options={normalizedPaths.map((path) => ({
                value: path,
                label: path.split("/").filter(Boolean).pop() || path,
              }))}
            />
          )}
        </div>
        <div className={styles.fileModalActions}>
          {showPreviewToggle && (
            <Segmented
              size="small"
              value={previewMode ? "preview" : "source"}
              options={[
                { label: t("common.preview"), value: "preview" },
                { label: t("workspace.source", "源码"), value: "source" },
              ]}
              onChange={(value) => setPreviewMode(value === "preview")}
            />
          )}
          <Tooltip title={t("common.refresh")}>
            <button
              type="button"
              className={styles.fileModalIconBtn}
              onClick={refresh}
              disabled={!resolvedPath || fileLoading}
              aria-label={t("common.refresh")}
            >
              <RefreshCw size={16} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip title={t("common.download")}>
            <button
              type="button"
              className={styles.fileModalIconBtn}
              onClick={() => void download()}
              disabled={!resolvedPath}
              aria-label={t("common.download")}
            >
              <ArrowDownToLine size={16} strokeWidth={2} />
            </button>
          </Tooltip>
          {isText &&
            (editMode ? (
              <Button
                size="small"
                type="primary"
                icon={<Save size={14} />}
                loading={saving}
                onClick={() => void save()}
              >
                {t("common.save")}
              </Button>
            ) : (
              <Button
                size="small"
                icon={<Pencil size={14} />}
                onClick={() => setEditMode(true)}
              >
                {t("common.edit")}
              </Button>
            ))}
        </div>
      </div>
      {readFailed && (
        <div role="alert" className={styles.filePanelReadError}>
          {hasCurrentContent
            ? t("policeWorkbench.preview.stale", "内容可能不是最新版本")
            : t("policeWorkbench.preview.failed", "文档加载失败")}
        </div>
      )}
      <div
        className={`${styles.fileModalBody} ${
          bodyFill ? styles.fileModalBodyFill : ""
        }`}
      >
        {resolvedPath && (
          <FileViewer
            agentId={agentId}
            path={resolvedPath}
            editMode={editMode}
            value={content}
            onChange={(value) =>
              setSnapshot({
                contextKey: currentContextKey,
                path: resolvedPath,
                content: value,
              })
            }
            fileLoading={fileLoading}
            previewMode={previewMode}
            refreshToken={refreshToken}
            onLoadStateChange={handleViewerState}
          />
        )}
      </div>
    </div>
  );
}
