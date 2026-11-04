import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Spin } from "antd";
import FilePreview, { getPreviewKind } from "./FilePreview";
import MediaPreview from "./MediaPreview";
import CodeEditor from "./CodeEditor";
import DocumentPreview from "./DocumentPreview";
import type { FileViewerStatusProps } from "./previewLoadState";
import { getMediaKind } from "../utils/mediaKind";
import { getDocKind } from "../utils/docKind";
import { isProbablyText } from "../utils/fileKind";
import styles from "../index.module.less";

interface FileViewerProps extends FileViewerStatusProps {
  readonly agentId: string;
  readonly path: string;
  readonly editMode: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly fileLoading?: boolean;
  readonly previewMode?: boolean;
  readonly refreshToken?: number;
}

export default function FileViewer({
  agentId,
  path,
  editMode,
  value,
  onChange,
  fileLoading = false,
  previewMode = true,
  refreshToken = 0,
  onLoadStateChange,
}: FileViewerProps) {
  const { t } = useTranslation();
  const mediaKind = getMediaKind(path);
  const docKind = getDocKind(path);
  const previewKind = getPreviewKind(path);
  const showEditButton = isProbablyText(path);

  useEffect(() => {
    if (!mediaKind && !docKind && !showEditButton) {
      onLoadStateChange?.({ status: "unsupported" });
    }
  }, [mediaKind, docKind, showEditButton, onLoadStateChange]);

  if (mediaKind) {
    return (
      <MediaPreview
        agentId={agentId}
        path={path}
        kind={mediaKind}
        refreshToken={refreshToken}
        onLoadStateChange={onLoadStateChange}
      />
    );
  }

  if (docKind) {
    return (
      <DocumentPreview
        agentId={agentId}
        path={path}
        kind={docKind}
        refreshToken={refreshToken}
        onLoadStateChange={onLoadStateChange}
      />
    );
  }

  if (fileLoading) {
    return (
      <div className={styles.viewerLoading}>
        <Spin />
      </div>
    );
  }

  if (!showEditButton) {
    return (
      <div className={styles.viewerEmpty}>
        <p style={{ color: "var(--fn-text-tertiary)", margin: 0 }}>
          {t("workspace.binaryHint", "该文件可能是二进制内容，请使用下载获取")}
        </p>
      </div>
    );
  }

  if (editMode) {
    return <CodeEditor path={path} value={value} onChange={onChange} />;
  }

  if (value === "") {
    return (
      <div className={styles.viewerEmpty}>
        <p style={{ color: "var(--fn-text-tertiary)", margin: 0 }}>
          {t("workspace.emptyFile", "文件为空")}
        </p>
      </div>
    );
  }

  if (previewKind && previewMode) {
    return (
      <FilePreview
        kind={previewKind}
        content={value}
        onRenderFailure={() => onLoadStateChange?.({ status: "render-failed" })}
      />
    );
  }

  return <pre className={styles.viewerPre}>{value}</pre>;
}
