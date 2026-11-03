import { useMemo, useSyncExternalStore } from "react";
import * as chatStore from "./chatStore";
import type {
  ArtifactChange,
  ChangeRecord,
  ResourceState,
  TaskBrief,
  WorkbenchContextKey,
  WorkspaceArtifact,
} from "../workbenchTypes";
import {
  deriveArtifactChangesFromMessages,
  deriveArtifactsFromMessages,
  deriveChangesFromMessages,
} from "../utils/taskArtifacts";
import { projectTaskBrief } from "../utils/taskBrief";
import {
  collectionState,
  emptyState,
  partialState,
  readyState,
} from "../utils/workbenchContext";

export interface TaskArtifactResult {
  readonly artifacts: ResourceState<readonly WorkspaceArtifact[]>;
  readonly changes: ResourceState<readonly ChangeRecord[]>;
  readonly artifactChanges: ResourceState<readonly ArtifactChange[]>;
  readonly brief: ResourceState<TaskBrief>;
  readonly historyComplete: boolean;
}

export function useTaskArtifacts(
  context: WorkbenchContextKey | null,
  readmeContent: string | null = null,
): TaskArtifactResult {
  const threadId = context?.threadId ?? "";
  const snapshot = useSyncExternalStore(
    (listener) =>
      threadId ? chatStore.subscribe(threadId, listener) : () => undefined,
    () =>
      threadId ? chatStore.getSnapshot(threadId) : chatStore.getSnapshot(""),
  );

  const messages = useMemo(
    () => (context?.threadId ? snapshot.messages : []),
    [context?.threadId, snapshot.messages],
  );
  const historyComplete = context?.threadId ? !snapshot.historyHasMore : false;

  const changes = useMemo<ResourceState<readonly ChangeRecord[]>>(() => {
    if (!context?.threadId) return { status: "idle" };
    const derived = deriveChangesFromMessages(messages);
    if (!historyComplete) {
      return derived.length > 0
        ? partialState(derived, String(messages.length))
        : partialState([], String(messages.length));
    }
    return collectionState(derived);
  }, [messages, context?.threadId, historyComplete]);

  const artifacts = useMemo<ResourceState<readonly WorkspaceArtifact[]>>(() => {
    if (!context?.threadId) return { status: "idle" };
    return collectionState(deriveArtifactsFromMessages(messages));
  }, [messages, context?.threadId]);

  const artifactChanges = useMemo<
    ResourceState<readonly ArtifactChange[]>
  >(() => {
    if (!context?.threadId) return { status: "idle" };
    return collectionState(
      deriveArtifactChangesFromMessages(messages, context),
    );
  }, [messages, context]);

  const brief = useMemo<ResourceState<TaskBrief>>(() => {
    if (!context) return { status: "idle" };
    const projected = projectTaskBrief(
      readmeContent,
      changes.status === "ready" || changes.status === "partial"
        ? changes.data
        : [],
      artifacts.status === "ready" ? artifacts.data : [],
    );
    if (
      projected.delivered.length === 0 &&
      projected.nextSteps.length === 0 &&
      projected.requiredMaterials.length === 0
    ) {
      return emptyState();
    }
    return readyState(projected);
  }, [context, changes, artifacts, readmeContent]);

  return { artifacts, changes, artifactChanges, brief, historyComplete };
}
