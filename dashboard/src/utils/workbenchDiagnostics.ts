import type { NavigationDiagnostic } from "../routes/policeCapabilities";
import type { PreviewDiagnostic } from "../pages/Chat/workbenchTypes";

function writeDiagnostic(scope: "navigation" | "preview", event: object): void {
  try {
    console.debug(`[PoliceWorkbench ${scope}]`, event);
  } catch {
    // Diagnostics must never block navigation or preview behavior.
  }
}

function normalizedDiagnosticPath(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? "";
}

export const workbenchDiagnostics = {
  navigation(event: NavigationDiagnostic): void {
    writeDiagnostic("navigation", {
      sourceEntry: event.sourceEntry,
      capabilityId: event.capabilityId,
      result: event.result,
      ...(event.reason ? { reason: event.reason } : {}),
    });
  },
  preview(event: PreviewDiagnostic): void {
    writeDiagnostic("preview", {
      contextKey: event.contextKey,
      path: normalizedDiagnosticPath(event.path),
      changeKind: event.changeKind,
      revision: event.revision,
      result: event.result,
      ...(event.reason ? { reason: event.reason } : {}),
    });
  },
};