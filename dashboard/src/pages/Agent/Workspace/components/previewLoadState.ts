import type { ResourceError } from "../../../Chat/workbenchTypes";

export type FileViewerLoadStatus =
  | { readonly status: "loading"; readonly hasPrevious: boolean }
  | { readonly status: "ready" }
  | { readonly status: "read-failed"; readonly error: ResourceError }
  | { readonly status: "render-failed" }
  | { readonly status: "unsupported" };

export interface FileViewerStatusProps {
  readonly onLoadStateChange?: (status: FileViewerLoadStatus) => void;
}

export function toPreviewResourceError(error: unknown): ResourceError {
  const message = error instanceof Error ? error.message : String(error);
  const kind = /unauthorized|\b401\b/i.test(message)
    ? "unauthorized"
    : /\b403\b/.test(message)
      ? "forbidden"
      : /\b404\b/.test(message)
        ? "unavailable"
        : "unknown";
  return { kind, message: "", retryable: kind === "unknown" };
}