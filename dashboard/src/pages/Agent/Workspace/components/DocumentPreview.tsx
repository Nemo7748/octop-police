import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spin } from "antd";
import { ArrowDownToLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { requestBlob } from "../../../../api/request";
import type { DocKind } from "../utils/docKind";
import {
  toPreviewResourceError,
  type FileViewerStatusProps,
} from "./previewLoadState";
import styles from "../index.module.less";

interface DocumentPreviewProps extends FileViewerStatusProps {
  readonly agentId: string;
  readonly path: string;
  readonly kind: DocKind;
  readonly refreshToken?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function DocumentPreview({
  agentId,
  path,
  kind,
  refreshToken = 0,
  onLoadStateChange,
}: DocumentPreviewProps) {
  const { t } = useTranslation();
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);
  const pptxViewerRef = useRef<{ destroy: () => void } | null>(null);
  const previousPathRef = useRef(path);

  const handleDownload = useCallback(async () => {
    try {
      const blob = await requestBlob(
        `/agents/${encodeURIComponent(agentId)}/workspace/download?path=${encodeURIComponent(path)}`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = path.split("/").filter(Boolean).pop() || "download";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      return;
    }
  }, [agentId, path]);

  useEffect(() => {
    const abortController = new AbortController();
    let stage: "read" | "render" = "read";
    const pathChanged = previousPathRef.current !== path;
    previousPathRef.current = path;
    const hasPrevious = Boolean(
      !pathChanged && (src || containerRef.current?.childElementCount),
    );

    if (pathChanged) {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
      pptxViewerRef.current?.destroy();
      pptxViewerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
      setSrc("");
    }
    setLoading(true);
    setError(false);
    onLoadStateChange?.({ status: "loading", hasPrevious });

    if (kind === "ppt") {
      setLoading(false);
      onLoadStateChange?.({ status: "unsupported" });
      return () => abortController.abort();
    }

    const load = async () => {
      try {
        const blob = await requestBlob(
          `/agents/${encodeURIComponent(agentId)}/workspace/download?path=${encodeURIComponent(path)}`,
          { signal: abortController.signal },
        );
        if (abortController.signal.aborted) return;
        stage = "render";

        if (kind === "pdf") {
          const pdfBlob =
            blob.type === "application/pdf"
              ? blob
              : new Blob([blob], { type: "application/pdf" });
          const objectUrl = URL.createObjectURL(pdfBlob);
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = objectUrl;
          setSrc(objectUrl);
        } else {
          const buffer = await blob.arrayBuffer();
          if (abortController.signal.aborted) return;
          if (kind === "word") {
            const { renderAsync } = await import("docx-preview");
            if (containerRef.current && !abortController.signal.aborted) {
              containerRef.current.innerHTML = "";
              await renderAsync(buffer, containerRef.current, undefined, {
                className: "docx-doc",
                inWrapper: true,
                breakPages: true,
                ignoreWidth: false,
                ignoreHeight: false,
              });
            }
          } else if (kind === "excel") {
            const xlsx = await import("xlsx");
            const workbook = xlsx.read(buffer, { type: "array" });
            if (containerRef.current && !abortController.signal.aborted) {
              containerRef.current.innerHTML = workbook.SheetNames.map((name) => {
                const html = xlsx.utils.sheet_to_html(workbook.Sheets[name]);
                return `<div class="${styles.xlsxSheet}"><div class="${styles.xlsxSheetTitle}">${escapeHtml(name)}</div>${html}</div>`;
              }).join("");
            }
          } else if (kind === "pptx") {
            const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import(
              "@aiden0z/pptx-renderer"
            );
            if (containerRef.current && !abortController.signal.aborted) {
              pptxViewerRef.current?.destroy();
              pptxViewerRef.current = null;
              containerRef.current.innerHTML = "";
              const viewer = await PptxViewer.open(buffer, containerRef.current, {
                zipLimits: RECOMMENDED_ZIP_LIMITS,
                lazySlides: true,
                lazyMedia: true,
                listOptions: {
                  windowed: true,
                  initialSlides: 4,
                  batchSize: 4,
                },
              });
              if (abortController.signal.aborted) viewer.destroy();
              else pptxViewerRef.current = viewer;
            }
          }
        }
        if (!abortController.signal.aborted) {
          setLoading(false);
          onLoadStateChange?.({ status: "ready" });
        }
      } catch (loadError) {
        if (abortController.signal.aborted) return;
        setError(true);
        setLoading(false);
        if (stage === "read") {
          onLoadStateChange?.({
            status: "read-failed",
            error: toPreviewResourceError(loadError),
          });
        } else {
          onLoadStateChange?.({ status: "render-failed" });
        }
      }
    };
    void load();
    return () => abortController.abort();
  }, [agentId, path, kind, refreshToken, onLoadStateChange]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
      pptxViewerRef.current?.destroy();
      pptxViewerRef.current = null;
    };
  }, []);

  if (kind === "ppt") {
    return (
      <div className={styles.viewerEmpty}>
        <p style={{ color: "var(--fn-text-tertiary)", margin: "0 0 12px" }}>
          {t("workspace.docPreviewUnsupported", "Online preview is not available for this document — please download it")}
        </p>
        <Button
          type="primary"
          icon={<ArrowDownToLine size={14} />}
          onClick={() => void handleDownload()}
        >
          {t("common.download", "下载")}
        </Button>
      </div>
    );
  }

  const errorBanner = error && (
    <div role="alert" className={styles.documentError}>
      {t("workspace.mediaLoadFailed", "无法加载预览")}
    </div>
  );

  if (kind === "pdf") {
    if (!src) {
      return (
        <div className={styles.viewerLoading}>
          {errorBanner}
          {!error && <Spin />}
        </div>
      );
    }
    return (
      <div className={styles.documentPreview}>
        {errorBanner}
        <iframe
          title={path.split("/").filter(Boolean).pop() || "PDF"}
          src={src}
          className={styles.docFrame}
        />
      </div>
    );
  }

  return (
    <div className={styles.documentPreview}>
      {errorBanner}
      <div
        className={
          kind === "word"
            ? styles.docxWrap
            : kind === "excel"
              ? styles.xlsxWrap
              : styles.pptxWrap
        }
        ref={containerRef}
      />
      {loading && (
        <div className={styles.documentLoading}>
          <Spin />
        </div>
      )}
    </div>
  );
}
