import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArtifactChange,
  PreviewDisplayStatus,
  PreviewRequestToken,
  PreviewSelection,
  PreviewSelectionMode,
  ResourceError,
  TaskArtifactItem,
} from "../workbenchTypes";
import { parseContextKey } from "../utils/workbenchContext";
import { projectTaskArtifacts } from "../utils/taskArtifacts";

const FOLLOW_DEBOUNCE_MS = 300;

export interface WorkbenchPreviewDock {
  readonly filePath: string | null;
  readonly handleClose: () => void;
  readonly clearPreviewSelection: () => void;
  readonly openFileAt: (path?: string | null) => void;
}

export interface WorkbenchPreviewController {
  readonly selection: PreviewSelection | null;
  readonly revision: number;
  readonly mode: PreviewSelectionMode;
  readonly displayStatus: PreviewDisplayStatus;
  readonly hasNewArtifact: boolean;
  readonly close: () => void;
  readonly clearInvalidSelection: () => void;
  readonly refresh: () => void;
  readonly open: (path: string) => void;
  readonly setFollowLatest: () => void;
  readonly applyChanges: (changes: readonly ArtifactChange[]) => void;
  readonly notifyReadSuccess: (token?: PreviewRequestToken) => void;
  readonly notifyReadFailure: (
    token?: PreviewRequestToken,
    error?: ResourceError,
  ) => void;
  readonly notifyRenderFailure: (token?: PreviewRequestToken) => void;
  readonly notifyUnsupported: (token?: PreviewRequestToken) => void;
  readonly notifyDeleted: (contextKeyOrPath: string, path?: string) => void;
}

function latestPreviewable(
  items: readonly TaskArtifactItem[],
): TaskArtifactItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item.phase === "confirmed" &&
      item.previewCapability === "previewable"
    ) {
      return item;
    }
  }
  return null;
}

export function useWorkbenchPreview(
  contextKey: string,
  dock: WorkbenchPreviewDock,
): WorkbenchPreviewController {
  const [selectionState, setSelectionState] =
    useState<PreviewSelection | null>(null);
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<PreviewSelectionMode>("follow-latest");
  const [displayStatus, setDisplayStatus] =
    useState<PreviewDisplayStatus>("idle");
  const [hasNewArtifact, setHasNewArtifact] = useState(false);

  const dockRef = useRef(dock);
  dockRef.current = dock;
  const revisionRef = useRef(0);
  const userDismissedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenChangeKeysRef = useRef(new Set<string>());
  const maxRevisionsRef = useRef(new Map<string, number>());
  const hasAppliedSnapshotRef = useRef(false);
  const latestPreviewableRef = useRef<TaskArtifactItem | null>(null);
  const hasGeneratingRef = useRef(false);

  const selection =
    selectionState?.contextKey === contextKey ? selectionState : null;
  const selectionRef = useRef<PreviewSelection | null>(selection);
  selectionRef.current = selection;

  const selectPath = useCallback(
    (
      path: string,
      nextMode: PreviewSelectionMode,
      status: PreviewDisplayStatus = "loading",
    ) => {
      revisionRef.current += 1;
      const nextRevision = revisionRef.current;
      setRevision(nextRevision);
      setSelectionState({
        contextKey,
        path,
        mode: nextMode,
        revision: nextRevision,
      });
      setMode(nextMode);
      setDisplayStatus(status);
      setHasNewArtifact(false);
      dockRef.current.openFileAt(path);
    },
    [contextKey],
  );

  useEffect(() => {
    revisionRef.current = 0;
    setRevision(0);
    setSelectionState(null);
    setMode("follow-latest");
    setDisplayStatus("idle");
    setHasNewArtifact(false);
    userDismissedRef.current = false;
    seenChangeKeysRef.current.clear();
    maxRevisionsRef.current.clear();
    hasAppliedSnapshotRef.current = false;
    latestPreviewableRef.current = null;
    hasGeneratingRef.current = false;
    dockRef.current.clearPreviewSelection();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [contextKey]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const open = useCallback(
    (path: string) => {
      userDismissedRef.current = false;
      selectPath(path, "manual");
    },
    [selectPath],
  );

  const close = useCallback(() => {
    userDismissedRef.current = true;
    dockRef.current.handleClose();
  }, []);

  const clearInvalidSelection = useCallback(() => {
    dockRef.current.clearPreviewSelection();
    setSelectionState(null);
    setDisplayStatus(hasGeneratingRef.current ? "generating" : "idle");
    setHasNewArtifact(false);
  }, []);

  const refresh = useCallback(() => {
    const current = selectionRef.current;
    if (current) selectPath(current.path, current.mode, "updating");
  }, [selectPath]);

  const setFollowLatest = useCallback(() => {
    userDismissedRef.current = false;
    setMode("follow-latest");
    setHasNewArtifact(false);
    const latest = latestPreviewableRef.current;
    if (latest) {
      selectPath(latest.path, "follow-latest");
    } else if (hasGeneratingRef.current) {
      setSelectionState(null);
      setDisplayStatus("generating");
    }
  }, [selectPath]);

  const applyChanges = useCallback(
    (changes: readonly ArtifactChange[]) => {
      const context = parseContextKey(contextKey);
      if (!context) return;
      const items = projectTaskArtifacts(context, changes);
      latestPreviewableRef.current = latestPreviewable(items);
      hasGeneratingRef.current = items.some(
        (item) => item.phase === "generating",
      );

      const firstSnapshot = !hasAppliedSnapshotRef.current;
      hasAppliedSnapshotRef.current = true;
      const newConfirmed: Extract<
        ArtifactChange,
        { readonly phase: "confirmed" }
      >[] = [];

      for (const change of changes) {
        if (
          change.context.agentId !== context.agentId ||
          change.context.threadId !== context.threadId
        ) {
          continue;
        }
        if (seenChangeKeysRef.current.has(change.changeKey)) continue;
        seenChangeKeysRef.current.add(change.changeKey);
        if (change.phase !== "confirmed") continue;
        const previousRevision = maxRevisionsRef.current.get(change.path) ?? 0;
        if (change.revision <= previousRevision) continue;
        maxRevisionsRef.current.set(change.path, change.revision);
        newConfirmed.push(change);
      }

      const actionable = newConfirmed.filter(
        (change) => firstSnapshot || change.occurredAt !== null,
      );
      const current = selectionRef.current;

      if (mode === "follow-latest") {
        const latest = latestPreviewableRef.current;
        if (latest && actionable.length > 0) {
          if (userDismissedRef.current) {
            setHasNewArtifact(true);
          } else {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              debounceTimerRef.current = null;
              const next = latestPreviewableRef.current;
              if (next && !userDismissedRef.current) {
                selectPath(next.path, "follow-latest");
              }
            }, FOLLOW_DEBOUNCE_MS);
          }
        } else if (hasGeneratingRef.current && !current) {
          setDisplayStatus("generating");
        } else if (items.length === 0) {
          setDisplayStatus("idle");
        }
        return;
      }

      if (!current) {
        if (newConfirmed.length > 0) setHasNewArtifact(true);
        if (hasGeneratingRef.current) setDisplayStatus("generating");
        return;
      }
      if (
        newConfirmed.some(
          (change) => change.path === current.path && change.kind === "delete",
        )
      ) {
        setDisplayStatus("deleted");
        return;
      }
      if (
        newConfirmed.some(
          (change) => change.path === current.path && change.kind !== "delete",
        )
      ) {
        selectPath(current.path, "manual", "updating");
      } else if (newConfirmed.length > 0) {
        setHasNewArtifact(true);
      }
    },
    [contextKey, mode, selectPath],
  );

  const isCurrentToken = useCallback((token?: PreviewRequestToken) => {
    if (!token) return true;
    const current = selectionRef.current;
    return (
      current?.contextKey === token.contextKey &&
      current.path === token.path &&
      current.revision === token.revision
    );
  }, []);

  const notifyReadSuccess = useCallback(
    (token?: PreviewRequestToken) => {
      if (isCurrentToken(token)) setDisplayStatus("ready");
    },
    [isCurrentToken],
  );

  const notifyReadFailure = useCallback(
    (token?: PreviewRequestToken, error?: ResourceError) => {
      if (!isCurrentToken(token)) return;
      if (error?.kind === "forbidden" || error?.kind === "unauthorized") {
        setDisplayStatus("forbidden");
      } else if (error?.kind === "unavailable") {
        setDisplayStatus("deleted");
      } else {
        setDisplayStatus("read-failed");
      }
    },
    [isCurrentToken],
  );

  const notifyRenderFailure = useCallback(
    (token?: PreviewRequestToken) => {
      if (isCurrentToken(token)) setDisplayStatus("render-failed");
    },
    [isCurrentToken],
  );

  const notifyUnsupported = useCallback(
    (token?: PreviewRequestToken) => {
      if (isCurrentToken(token)) setDisplayStatus("unsupported");
    },
    [isCurrentToken],
  );

  const notifyDeleted = useCallback(
    (contextKeyOrPath: string, path?: string) => {
      const current = selectionRef.current;
      if (!current) return;
      if (
        path
          ? current.contextKey === contextKeyOrPath && current.path === path
          : current.path === contextKeyOrPath
      ) {
        setDisplayStatus("deleted");
      }
    },
    [],
  );

  return {
    selection,
    revision,
    mode,
    displayStatus,
    hasNewArtifact,
    close,
    clearInvalidSelection,
    refresh,
    open,
    setFollowLatest,
    applyChanges,
    notifyReadSuccess,
    notifyReadFailure,
    notifyRenderFailure,
    notifyUnsupported,
    notifyDeleted,
  };
}
