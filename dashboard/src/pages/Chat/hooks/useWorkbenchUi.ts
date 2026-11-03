import { useCallback, useState } from "react";

export type WorkbenchBusinessTag = "office" | "coding" | "design";

const DIRECTORY_KEY = "octop:workbench:directory-open";
const PREVIEW_KEY = "octop:workbench:preview-open";

function readPreference(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    return saved === "true";
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable */
  }
}

export interface WorkbenchUiState {
  readonly directoryOpen: boolean;
  readonly previewOpen: boolean;
  readonly catalogSearch: string;
  readonly businessTag: WorkbenchBusinessTag | null;
  readonly toggleDirectory: () => void;
  readonly togglePreview: () => void;
  readonly setDirectoryOpen: (open: boolean) => void;
  readonly setPreviewOpen: (open: boolean) => void;
  readonly setCatalogSearch: (query: string) => void;
  readonly setBusinessTag: (tag: WorkbenchBusinessTag | null) => void;
}

export function useWorkbenchUi(): WorkbenchUiState {
  const [directoryOpen, setDirectoryOpenState] = useState(() =>
    readPreference(DIRECTORY_KEY, true),
  );
  const [previewOpen, setPreviewOpenState] = useState(() =>
    readPreference(PREVIEW_KEY, false),
  );
  const [catalogSearch, setCatalogSearch] = useState("");
  const [businessTag, setBusinessTag] = useState<WorkbenchBusinessTag | null>(
    null,
  );

  const setDirectoryOpen = useCallback((open: boolean) => {
    setDirectoryOpenState(open);
    writePreference(DIRECTORY_KEY, open);
  }, []);

  const setPreviewOpen = useCallback((open: boolean) => {
    setPreviewOpenState(open);
    writePreference(PREVIEW_KEY, open);
  }, []);

  const toggleDirectory = useCallback(() => {
    setDirectoryOpenState((prev) => {
      writePreference(DIRECTORY_KEY, !prev);
      return !prev;
    });
  }, []);

  const togglePreview = useCallback(() => {
    setPreviewOpenState((prev) => {
      writePreference(PREVIEW_KEY, !prev);
      return !prev;
    });
  }, []);

  return {
    directoryOpen,
    previewOpen,
    catalogSearch,
    businessTag,
    toggleDirectory,
    togglePreview,
    setDirectoryOpen,
    setPreviewOpen,
    setCatalogSearch,
    setBusinessTag,
  };
}
