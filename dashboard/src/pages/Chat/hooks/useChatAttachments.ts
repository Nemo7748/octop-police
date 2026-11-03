import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { message as antMessage } from "antd";
import { useTranslation } from "react-i18next";
import { uploadFile } from "../../../api/modules/upload";
import { agentAttachmentAccessUrl } from "../../../utils/toolMediaBlocks";
import type { ChatAttachment } from "./useChat";
import * as composerDraftStore from "./composerDraftStore";
import { makeContextKey } from "../utils/workbenchContext";
import {
  CHAT_ACCEPT_ATTR,
  CHAT_MAX_ATTACHMENT_BYTES,
  inferAttachmentKind,
  isAcceptedChatFile,
} from "../utils/chatAttachments";

const EMPTY_ATTACHMENTS: readonly ChatAttachment[] = Object.freeze([]);

export function useChatAttachments(
  agentId: string | null | undefined,
  threadId?: string | null,
) {
  const { t } = useTranslation();
  const contextKey = useMemo(
    () =>
      agentId ? makeContextKey({ agentId, threadId: threadId ?? null }) : "",
    [agentId, threadId],
  );
  const attachments = useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        contextKey
          ? composerDraftStore.subscribe(contextKey, listener)
          : () => undefined,
      [contextKey],
    ),
    useCallback(
      () =>
        contextKey
          ? composerDraftStore.getSnapshot(contextKey).attachments
          : EMPTY_ATTACHMENTS,
      [contextKey],
    ),
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files).filter((f) => {
        if (!isAcceptedChatFile(f)) {
          antMessage.error(
            t("upload.unsupportedType", "Unsupported file type: {{type}}", {
              type: f.type || f.name || "unknown",
            }),
          );
          return false;
        }
        if (f.size > CHAT_MAX_ATTACHMENT_BYTES) {
          antMessage.error(
            t("upload.tooLarge", "File too large (max 20MB): {{name}}", {
              name: f.name,
            }),
          );
          return false;
        }
        return true;
      });

      if (fileArr.length === 0) return;

      if (!agentId) {
        antMessage.error(t("upload.failed", "Upload failed"));
        return;
      }

      setUploading(true);
      try {
        const results = await Promise.all(
          fileArr.map(async (file) => {
            const res = await uploadFile(agentId, file);
            const workspacePath = res.path || res.workspace_path;
            const previewUrl =
              res.access_url ||
              res.url ||
              (workspacePath
                ? agentAttachmentAccessUrl(
                    agentId,
                    workspacePath,
                    res.media_type,
                  )
                : "");
            return {
              url: previewUrl,
              filename: res.filename,
              mediaType: res.media_type,
              workspacePath,
              kind: inferAttachmentKind(file, res.media_type),
            } satisfies ChatAttachment;
          }),
        );
        if (contextKey) {
          composerDraftStore.setAttachments(contextKey, [
            ...composerDraftStore.getSnapshot(contextKey).attachments,
            ...results,
          ]);
        }
      } catch (err: unknown) {
        antMessage.error(
          (err as Error).message || t("upload.failed", "Upload failed"),
        );
      } finally {
        setUploading(false);
      }
    },
    [agentId, t, contextKey],
  );

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void processFiles(e.target.files);
      }
      e.target.value = "";
    },
    [processFiles],
  );

  const removeAttachment = useCallback(
    (index: number) => {
      if (!contextKey) return;
      composerDraftStore.setAttachments(
        contextKey,
        composerDraftStore
          .getSnapshot(contextKey)
          .attachments.filter((_, i) => i !== index),
      );
    },
    [contextKey],
  );

  const clearAttachments = useCallback(() => {
    if (!contextKey) return;
    composerDraftStore.setAttachments(contextKey, []);
  }, [contextKey]);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        void processFiles(pastedFiles);
      }
    },
    [processFiles],
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        void processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  return {
    attachments,
    uploading,
    dragOver,
    fileInputRef,
    acceptAttr: CHAT_ACCEPT_ATTR,
    processFiles,
    handleFileSelect,
    handleFileChange,
    removeAttachment,
    clearAttachments,
    handlePaste,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
