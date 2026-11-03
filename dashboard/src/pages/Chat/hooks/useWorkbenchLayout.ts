import { useEffect, useState } from "react";

export type WorkbenchBreakpoint = "wide" | "medium" | "narrow";

export const WIDE_MIN_WIDTH = 1280;
export const MEDIUM_MIN_WIDTH = 768;

export function resolveBreakpoint(width: number): WorkbenchBreakpoint {
  if (width >= WIDE_MIN_WIDTH) return "wide";
  if (width >= MEDIUM_MIN_WIDTH) return "medium";
  return "narrow";
}

export interface WorkbenchLayout {
  readonly breakpoint: WorkbenchBreakpoint;
  readonly isWide: boolean;
  readonly isMedium: boolean;
  readonly isNarrow: boolean;
  readonly directoryOverlay: boolean;
  readonly previewOverlay: boolean;
}

export function deriveLayout(breakpoint: WorkbenchBreakpoint): WorkbenchLayout {
  return {
    breakpoint,
    isWide: breakpoint === "wide",
    isMedium: breakpoint === "medium",
    isNarrow: breakpoint === "narrow",
    directoryOverlay: breakpoint !== "wide",
    previewOverlay: breakpoint !== "wide",
  };
}

export function useWorkbenchLayout(): WorkbenchLayout {
  const [breakpoint, setBreakpoint] = useState<WorkbenchBreakpoint>(() =>
    resolveBreakpoint(
      typeof window === "undefined" ? WIDE_MIN_WIDTH : window.innerWidth,
    ),
  );

  useEffect(() => {
    const wideQuery = window.matchMedia(`(min-width: ${WIDE_MIN_WIDTH}px)`);
    const mediumQuery = window.matchMedia(`(min-width: ${MEDIUM_MIN_WIDTH}px)`);
    const update = () => {
      setBreakpoint(
        wideQuery.matches ? "wide" : mediumQuery.matches ? "medium" : "narrow",
      );
    };
    update();
    wideQuery.addEventListener("change", update);
    mediumQuery.addEventListener("change", update);
    return () => {
      wideQuery.removeEventListener("change", update);
      mediumQuery.removeEventListener("change", update);
    };
  }, []);

  return deriveLayout(breakpoint);
}
