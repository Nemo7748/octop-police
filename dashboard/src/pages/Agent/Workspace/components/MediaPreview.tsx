import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "antd";
import { useTranslation } from "react-i18next";
import { requestBlob } from "../../../../api/request";
import { asImageBlob } from "../../../../utils/toolMediaBlocks";
import type { MediaKind } from "../utils/mediaKind";
import {
  toPreviewResourceError,
  type FileViewerStatusProps,
} from "./previewLoadState";
import styles from "../index.module.less";

function guessMediaMime(kind: MediaKind, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (kind === "video") {
    if (ext === "webm") return "video/webm";
    if (ext === "mov" || ext === "m4v") return "video/quicktime";
    if (ext === "ogv") return "video/ogg";
    return "video/mp4";
  }
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg" || ext === "opus") return "audio/ogg";
  if (ext === "m4a" || ext === "aac") return "audio/mp4";
  if (ext === "flac") return "audio/flac";
  if (ext === "weba") return "audio/webm";
  return "audio/mpeg";
}

interface MediaPreviewProps extends FileViewerStatusProps {
  readonly agentId: string;
  readonly path: string;
  readonly kind: MediaKind;
  readonly refreshToken?: number;
}

export default function MediaPreview({
  agentId,
  path,
  kind,
  refreshToken = 0,
  onLoadStateChange,
}: MediaPreviewProps) {
  const { t } = useTranslation();
  const filename = path.split("/").filter(Boolean).pop() || path;
  const [src, setSrc] = useState("");
  const objectUrlRef = useRef<string | undefined>(undefined);
  const apiPath = useMemo(() => {
    const source = path.startsWith("file://")
      ? path
      : path.startsWith("/")
        ? `file://${path}`
        : path.replace(/^\/+/, "");
    return `/agents/${encodeURIComponent(agentId)}/media/preview?${new URLSearchParams({ source }).toString()}`;
  }, [agentId, path]);

  useEffect(() => {
    const abortController = new AbortController();
    onLoadStateChange?.({
      status: "loading",
      hasPrevious: Boolean(objectUrlRef.current),
    });
    const load = async () => {
      try {
        const response = await requestBlob(apiPath, {
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) return;
        const blob =
          kind === "image"
            ? asImageBlob(response, filename)
            : response.type && response.type !== "application/octet-stream"
              ? response
              : new Blob([response], { type: guessMediaMime(kind, filename) });
        const objectUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;
        setSrc(objectUrl);
        onLoadStateChange?.({ status: "ready" });
      } catch (error) {
        if (abortController.signal.aborted) return;
        if (!objectUrlRef.current) setSrc("error");
        onLoadStateChange?.({
          status: "read-failed",
          error: toPreviewResourceError(error),
        });
      }
    };
    void load();
    return () => abortController.abort();
  }, [apiPath, filename, kind, refreshToken, onLoadStateChange]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
    };
  }, []);

  if (src === "error" || !src) {
    return (
      <span className={styles.mediaFallback}>
        {src === "error"
          ? t("workspace.mediaLoadFailed", "无法加载预览")
          : "…"}
      </span>
    );
  }

  return (
    <div className={styles.mediaPreviewFrame}>
      {kind === "image" && (
        <Image src={src} alt={filename} className={styles.mediaPreviewImage} />
      )}
      {kind === "video" && (
        <video
          className={styles.mediaPreviewVideo}
          src={src}
          controls
          preload="metadata"
          playsInline
        />
      )}
      {kind === "audio" && (
        <audio
          className={styles.mediaPreviewAudio}
          src={src}
          controls
          preload="metadata"
        />
      )}
    </div>
  );
}
