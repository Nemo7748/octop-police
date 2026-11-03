import type {
  ChangeRecord,
  ResourceError,
  ResourceErrorKind,
  ResourceState,
  TaskBrief,
  TaskRunStatus,
  WorkbenchContextKey,
  WorkspaceArtifact,
} from "../workbenchTypes";

export const NEW_TASK_THREAD_KEY = "__new__";

export function makeContextKey(context: WorkbenchContextKey): string {
  return `${context.agentId}:${context.threadId ?? NEW_TASK_THREAD_KEY}`;
}

export function parseContextKey(key: string): WorkbenchContextKey | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;
  const agentId = key.slice(0, separator);
  const threadPart = key.slice(separator + 1);
  if (!agentId || !threadPart) return null;
  return {
    agentId,
    threadId: threadPart === NEW_TASK_THREAD_KEY ? null : threadPart,
  };
}

export function isSameContext(
  a: WorkbenchContextKey | null,
  b: WorkbenchContextKey | null,
): boolean {
  if (!a || !b) return a === b;
  return a.agentId === b.agentId && a.threadId === b.threadId;
}

export function idleState<T>(): ResourceState<T> {
  return { status: "idle" };
}

export function loadingState<T>(previous?: T): ResourceState<T> {
  return previous === undefined
    ? { status: "loading" }
    : { status: "loading", previous };
}

export function readyState<T>(data: T): ResourceState<T> {
  return { status: "ready", data };
}

export function emptyState<T>(): ResourceState<T> {
  return { status: "empty" };
}

export function partialState<T>(
  data: T,
  loadedScope: string,
): ResourceState<T> {
  return { status: "partial", data, loadedScope };
}

export function errorState<T>(error: ResourceError): ResourceState<T> {
  return { status: "error", error };
}

export function collectionState<T>(
  items: readonly T[],
): ResourceState<readonly T[]> {
  return items.length === 0 ? emptyState() : readyState(items);
}

export function isCompleteState<T>(state: ResourceState<T>): boolean {
  return state.status === "ready" || state.status === "empty";
}

export function stateCount<T>(
  state: ResourceState<readonly T[]>,
): number | null {
  if (state.status === "ready") return state.data.length;
  if (state.status === "empty") return 0;
  return null;
}

export function normalizeWorkspacePath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file://")) return null;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return null;
  if (trimmed.includes("\0")) return null;
  const segments = trimmed.replace(/\\/g, "/").split("/");
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") return null;
    normalized.push(segment);
  }
  if (normalized.length === 0) return null;
  return normalized.join("/");
}

export function isConversationFilePath(path: string): boolean {
  const normalized = normalizeWorkspacePath(path);
  if (!normalized) return false;
  return (
    normalized.startsWith("inbound/") || normalized.startsWith("outbound/")
  );
}

export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

export function isReadmePath(path: string): boolean {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  return name === "readme.md" || name === "readme.markdown";
}

export function dedupeArtifacts(
  artifacts: readonly WorkspaceArtifact[],
): readonly WorkspaceArtifact[] {
  const byPath = new Map<string, WorkspaceArtifact>();
  for (const artifact of artifacts) {
    const normalized = normalizeWorkspacePath(artifact.path);
    if (!normalized) continue;
    if (!byPath.has(normalized)) {
      byPath.set(normalized, { ...artifact, path: normalized });
    }
  }
  return Array.from(byPath.values());
}

export function dedupeChanges(
  changes: readonly ChangeRecord[],
): readonly ChangeRecord[] {
  const byCallId = new Map<string, ChangeRecord>();
  for (const change of changes) {
    if (!byCallId.has(change.callId)) {
      byCallId.set(change.callId, change);
    }
  }
  return Array.from(byCallId.values());
}

export function emptyTaskBrief(): TaskBrief {
  return { delivered: [], nextSteps: [], requiredMaterials: [] };
}

export function hasBriefContent(brief: TaskBrief): boolean {
  return (
    brief.delivered.length > 0 ||
    brief.nextSteps.length > 0 ||
    brief.requiredMaterials.length > 0
  );
}

export function mapApiErrorKind(error: unknown): ResourceErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b401\b/.test(message)) return "unauthorized";
  if (/\b403\b/.test(message)) return "forbidden";
  if (/\b404\b/.test(message)) return "unavailable";
  return "unknown";
}

export function resolveRunStatus(
  raw: string | null | undefined,
): TaskRunStatus {
  switch (raw) {
    case "running":
    case "done":
    case "failed":
    case "cancelled":
      return raw;
    default:
      return "unknown";
  }
}
