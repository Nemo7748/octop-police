import { useCallback, useEffect, useState } from "react";
import type { WorkbenchLayout } from "./useWorkbenchLayout";

export type WorkbenchBusinessTag = "office" | "coding" | "design";
export type WorkbenchPanelId = "directory" | "preview";

export interface WorkbenchUiState {
  readonly activeAuxPanel: WorkbenchPanelId | null;
  readonly directoryOpen: boolean;
  readonly previewOpen: boolean;
  readonly catalogSearch: string;
  readonly businessTag: WorkbenchBusinessTag | null;
  readonly toggleDirectory: () => void;
  readonly togglePreview: () => void;
  readonly setDirectoryOpen: (open: boolean) => void;
  readonly setPreviewOpen: (open: boolean) => void;
  readonly setActiveAuxPanel: (panel: WorkbenchPanelId | null) => void;
  readonly closeAuxPanel: () => void;
  readonly setCatalogSearch: (query: string) => void;
  readonly setBusinessTag: (tag: WorkbenchBusinessTag | null) => void;
}

export function useWorkbenchUi(layout: WorkbenchLayout): WorkbenchUiState {
  const [activeAuxPanel, setActiveAuxPanel] = useState<WorkbenchPanelId | null>(
    null,
  );
  const [catalogSearch, setCatalogSearch] = useState("");
  const [businessTag, setBusinessTag] = useState<WorkbenchBusinessTag | null>(
    null,
  );

  useEffect(() => {
    if (layout.isWide) setActiveAuxPanel(null);
  }, [layout.isWide]);

  const setDirectoryOpen = useCallback(
    (open: boolean) => {
      setActiveAuxPanel((current) => {
        if (layout.isWide) return null;
        if (open) return "directory";
        return current === "directory" ? null : current;
      });
    },
    [layout.isWide],
  );

  const setPreviewOpen = useCallback(
    (open: boolean) => {
      setActiveAuxPanel((current) => {
        if (layout.isWide) return null;
        if (open) return "preview";
        return current === "preview" ? null : current;
      });
    },
    [layout.isWide],
  );

  const toggleDirectory = useCallback(() => {
    setActiveAuxPanel((current) =>
      !layout.isWide && current !== "directory" ? "directory" : null,
    );
  }, [layout.isWide]);

  const togglePreview = useCallback(() => {
    setActiveAuxPanel((current) =>
      !layout.isWide && current !== "preview" ? "preview" : null,
    );
  }, [layout.isWide]);

  const closeAuxPanel = useCallback(() => setActiveAuxPanel(null), []);

  return {
    activeAuxPanel: layout.isWide ? null : activeAuxPanel,
    directoryOpen: layout.isWide || activeAuxPanel === "directory",
    previewOpen: layout.isWide || activeAuxPanel === "preview",
    catalogSearch,
    businessTag,
    toggleDirectory,
    togglePreview,
    setDirectoryOpen,
    setPreviewOpen,
    setActiveAuxPanel,
    closeAuxPanel,
    setCatalogSearch,
    setBusinessTag,
  };
}
