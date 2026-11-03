import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { workspaceApi } from "../../../api/modules/workspace";
import type { ResourceState, WorkspaceArtifact } from "../workbenchTypes";
import {
  dedupeArtifacts,
  errorState,
  loadingState,
  mapApiErrorKind,
  normalizeWorkspacePath,
  readyState,
} from "../utils/workbenchContext";
import {
  entryDirectoryPath,
  entryToArtifact,
  findDefaultReadme,
  shouldRecurseDirectory,
  conversationFileCandidates,
} from "../utils/workspaceIndex";

export interface WorkspaceIndexOptions {
  readonly agentId: string | null;
  readonly enabled: boolean;
}

export interface WorkspaceIndexResult {
  readonly state: ResourceState<readonly WorkspaceArtifact[]>;
  readonly defaultReadme: WorkspaceArtifact | null;
  readonly conversationFiles: readonly WorkspaceArtifact[];
  readonly refresh: () => Promise<void>;
  readonly contains: (path: string) => boolean;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useWorkspaceIndex({
  agentId,
  enabled,
}: WorkspaceIndexOptions): WorkspaceIndexResult {
  const [state, setState] = useState<
    ResourceState<readonly WorkspaceArtifact[]>
  >({
    status: "idle",
  });
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!agentId || !enabled) {
      setState({ status: "idle" });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++generationRef.current;
    setState((prev) =>
      loadingState(prev.status === "ready" ? prev.data : undefined),
    );
    const collected: WorkspaceArtifact[] = [];
    try {
      let queue: Array<{ path: string; depth: number }> = [
        { path: ".", depth: 0 },
      ];
      let visited = 0;
      while (queue.length > 0) {
        const batch = queue.splice(0, 4);
        const results = await Promise.all(
          batch.map(async ({ path, depth }) => {
            const entries = await workspaceApi.listAgentDirectory(
              agentId,
              path,
              { signal: controller.signal },
            );
            return { entries, depth };
          }),
        );
        if (controller.signal.aborted || generation !== generationRef.current) {
          return;
        }
        const next: Array<{ path: string; depth: number }> = [];
        for (const { entries, depth } of results) {
          for (const entry of entries) {
            const artifact = entryToArtifact(entry);
            if (artifact) collected.push(artifact);
            const dirPath = entryDirectoryPath(entry);
            if (
              dirPath &&
              shouldRecurseDirectory(depth, visited + next.length)
            ) {
              next.push({ path: dirPath, depth: depth + 1 });
            }
          }
        }
        visited += batch.length;
        queue = [...queue, ...next];
      }
      if (generation !== generationRef.current) return;
      const artifacts = dedupeArtifacts(collected);
      setState(readyState(artifacts));
    } catch (error) {
      if (isAbort(error) || generation !== generationRef.current) return;
      setState(
        errorState({
          kind: mapApiErrorKind(error),
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        }),
      );
    }
  }, [agentId, enabled]);

  useEffect(() => {
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const artifacts = useMemo<readonly WorkspaceArtifact[]>(
    () => (state.status === "ready" ? state.data : []),
    [state],
  );
  const pathSet = useMemo(
    () => new Set(artifacts.map((artifact) => artifact.path)),
    [artifacts],
  );

  const contains = useCallback(
    (path: string) => {
      const normalized = normalizeWorkspacePath(path);
      return normalized ? pathSet.has(normalized) : false;
    },
    [pathSet],
  );

  return {
    state,
    defaultReadme: findDefaultReadme(artifacts),
    conversationFiles: conversationFileCandidates(artifacts),
    refresh: load,
    contains,
  };
}
