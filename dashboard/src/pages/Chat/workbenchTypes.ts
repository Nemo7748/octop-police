export type ResourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "partial"
  | "error";

export type ResourceErrorKind =
  | "forbidden"
  | "unavailable"
  | "unauthorized"
  | "unknown";

export interface ResourceError {
  readonly kind: ResourceErrorKind;
  readonly message: string;
  readonly retryable: boolean;
}

export type ResourceState<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly previous?: T }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "empty" }
  | {
      readonly status: "partial";
      readonly data: T;
      readonly loadedScope: string;
    }
  | { readonly status: "error"; readonly error: ResourceError };

export interface WorkbenchContextKey {
  readonly agentId: string;
  readonly threadId: string | null;
}

export type TaskRunStatus =
  | "running"
  | "done"
  | "failed"
  | "cancelled"
  | "unknown";

export type WorkspaceRunStatus = TaskRunStatus | "not-started";

export interface TaskCatalogItem {
  readonly agentId: string;
  readonly threadId: string;
  readonly name: string;
  readonly updatedAt: string | null;
  readonly status: TaskRunStatus;
  readonly unreadCount: number | null;
  readonly pinned: boolean;
}

export interface SpaceCatalogItem {
  readonly agentId: string;
  readonly name: string;
  readonly state: string;
  readonly unreadCount: number;
}

export interface WorkspaceArtifact {
  readonly path: string;
  readonly name: string;
  readonly size: number | null;
  readonly modifiedAt: string | null;
  readonly source: "workspace" | "message" | "tool";
}

export type ChangeKind = "write" | "edit" | "delete";

export interface ChangeRecord {
  readonly callId: string;
  readonly path: string;
  readonly kind: ChangeKind;
  readonly occurredAt: string | null;
}

interface ArtifactChangeBase {
  readonly context: WorkbenchContextKey;
  readonly path: string;
  readonly kind: ChangeKind;
  readonly changeKey: string;
  readonly occurredAt: string | null;
}

export type ArtifactChange =
  | (ArtifactChangeBase & {
      readonly phase: "generating";
      readonly revision: null;
    })
  | (ArtifactChangeBase & {
      readonly phase: "confirmed";
      readonly revision: number;
    });

export type ArtifactPhase = "generating" | "confirmed" | "deleted";
export type ArtifactPreviewCapability = "previewable" | "unsupported";

export interface TaskArtifactItem {
  readonly contextKey: string;
  readonly path: string;
  readonly name: string;
  readonly kind: ChangeKind;
  readonly phase: ArtifactPhase;
  readonly revision: number | null;
  readonly occurredAt: string | null;
  readonly previewCapability: ArtifactPreviewCapability;
}

export interface TaskBrief {
  readonly delivered: readonly string[];
  readonly nextSteps: readonly string[];
  readonly requiredMaterials: readonly string[];
}

export type ExecutionMode = "ask" | "act" | "plan";

export type SendReceipt =
  | { readonly status: "accepted" }
  | { readonly status: "empty" }
  | { readonly status: "error"; readonly reason: string };

export interface ConversationReference {
  readonly path: string;
  readonly name: string;
  readonly kind: "file" | "image";
}

export interface ComposerResourceSnapshot {
  readonly roleAgentId: string | null;
  readonly model: string | null;
  readonly skills: readonly string[];
  readonly connectors: readonly string[];
  readonly references: readonly ConversationReference[];
  readonly attachmentCount: number;
}

export interface PlanSnapshot {
  readonly contextKey: string;
  readonly goalText: string;
  readonly resources: ComposerResourceSnapshot;
  readonly fingerprint: string;
}

export type PreviewSelectionMode = "follow-latest" | "manual";

export type PreviewDisplayStatus =
  | "idle"
  | "generating"
  | "loading"
  | "updating"
  | "ready"
  | "read-failed"
  | "render-failed"
  | "unsupported"
  | "deleted"
  | "forbidden";

export interface PreviewSelection {
  readonly contextKey: string;
  readonly path: string;
  readonly mode: PreviewSelectionMode;
  readonly revision: number;
}

export interface PreviewRequestToken {
  readonly contextKey: string;
  readonly path: string;
  readonly revision: number;
}

export type PreviewDiagnosticReason =
  | "context-mismatch"
  | "stale-revision"
  | "duplicate-change"
  | "read-failed"
  | "render-failed"
  | "forbidden"
  | "unsupported";

export interface PreviewDiagnostic {
  readonly occurredAt: string;
  readonly contextKey: string;
  readonly path: string;
  readonly changeKind: ChangeKind | "manual";
  readonly revision: number;
  readonly result: "opened" | "updated" | "ignored" | "failed";
  readonly reason?: PreviewDiagnosticReason;
}
