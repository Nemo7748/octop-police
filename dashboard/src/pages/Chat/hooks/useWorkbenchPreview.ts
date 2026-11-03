import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArtifactChange,
  PreviewDisplayStatus,
  PreviewSelection,
  PreviewSelectionMode,
} from "../workbenchTypes";

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
  readonly notifyReadSuccess: () => void;
  readonly notifyReadFailure: () => void;
  readonly notifyUnsupported: () => void;
  readonly notifyDeleted: (path: string) => void;
}

export function useWorkbenchPreview(
  contextKey: string,
  dock: WorkbenchPreviewDock,
): WorkbenchPreviewController {
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<PreviewSelectionMode>("follow-latest");
  const [displayStatus, setDisplayStatus] =
    useState<PreviewDisplayStatus>("idle");
  const [hasNewArtifact, setHasNewArtifact] = useState(false);

  const userDismissedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevContextKeyRef = useRef(contextKey);

  useEffect(() => {
    if (prevContextKeyRef.current !== contextKey) {
      prevContextKeyRef.current = contextKey;
      userDismissedRef.current = false;
      setRevision(0);
      setMode("follow-latest");
      setDisplayStatus("idle");
      setHasNewArtifact(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [contextKey]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const open = useCallback(
    (path: string) => {
      userDismissedRef.current = false;
      setMode("manual");
      dock.openFileAt(path);
      setRevision((value) => value + 1);
      setDisplayStatus("loading");
      setHasNewArtifact(false);
    },
    [dock],
  );

  const close = useCallback(() => {
    userDismissedRef.current = true;
    dock.handleClose();
  }, [dock]);

  const clearInvalidSelection = useCallback(() => {
    dock.clearPreviewSelection();
    setDisplayStatus("idle");
    setHasNewArtifact(false);
  }, [dock]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
    setDisplayStatus("updating");
  }, []);

  const setFollowLatest = useCallback(() => {
    setMode("follow-latest");
    setHasNewArtifact(false);
  }, []);

  const applyChanges = useCallback(
    (changes: readonly ArtifactChange[]) => {
      const confirmed = changes.filter((c) => c.phase === "confirmed");
      if (confirmed.length === 0) return;
      const latest = confirmed[confirmed.length - 1];
      if (mode === "follow-latest") {
        if (userDismissedRef.current) {
          setHasNewArtifact(true);
          return;
        }
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          dock.openFileAt(latest.path);
          setRevision((value) => value + 1);
          setDisplayStatus("loading");
        }, FOLLOW_DEBOUNCE_MS);
      } else {
        if (dock.filePath && confirmed.some((c) => c.path === dock.filePath)) {
          setRevision((value) => value + 1);
          setDisplayStatus("updating");
        } else {
          setHasNewArtifact(true);
        }
      }
    },
    [mode, dock],
  );

  const notifyReadSuccess = useCallback(() => {
    setDisplayStatus("ready");
  }, []);

  const notifyReadFailure = useCallback(() => {
    setDisplayStatus("read-failed");
  }, []);

  const notifyUnsupported = useCallback(() => {
    setDisplayStatus("unsupported");
  }, []);

  const notifyDeleted = useCallback(
    (path: string) => {
      if (dock.filePath === path) {
        setDisplayStatus("deleted");
      }
    },
    [dock],
  );

  const selection: PreviewSelection | null = dock.filePath
    ? { contextKey, path: dock.filePath, mode, revision }
    : null;

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
    notifyUnsupported,
    notifyDeleted,
  };
}
