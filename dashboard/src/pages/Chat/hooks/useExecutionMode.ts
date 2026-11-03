import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import * as composerDraftStore from "./composerDraftStore";
import type {
  ComposerResourceSnapshot,
  ExecutionMode,
  PlanSnapshot,
} from "../workbenchTypes";

export function computePlanFingerprint(
  goalText: string,
  resources: ComposerResourceSnapshot,
): string {
  return JSON.stringify({
    goal: goalText.trim(),
    role: resources.roleAgentId,
    model: resources.model,
    skills: [...resources.skills].sort(),
    connectors: [...resources.connectors].sort(),
    references: resources.references.map((reference) => reference.path).sort(),
    attachments: resources.attachmentCount,
  });
}

export interface ExecutionModeController {
  readonly mode: ExecutionMode;
  readonly setMode: (mode: ExecutionMode) => void;
  readonly pendingPlan: PlanSnapshot | null;
  readonly planCancelled: boolean;
  readonly beginPlan: (
    goalText: string,
    resources: ComposerResourceSnapshot,
  ) => PlanSnapshot;
  readonly confirmPlan: (
    currentGoalText: string,
    currentResources: ComposerResourceSnapshot,
    execute: () => void,
  ) => boolean;
  readonly cancelPlan: () => void;
  readonly clearPlanFeedback: () => void;
}

export function useExecutionMode(contextKey: string): ExecutionModeController {
  const mode = useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        contextKey
          ? composerDraftStore.subscribe(contextKey, listener)
          : () => undefined,
      [contextKey],
    ),
    useCallback(
      () =>
        contextKey
          ? composerDraftStore.getSnapshot(contextKey).mode
          : ("act" as ExecutionMode),
      [contextKey],
    ),
  );
  const [pendingPlan, setPendingPlan] = useState<PlanSnapshot | null>(null);
  const [planCancelled, setPlanCancelled] = useState(false);

  useEffect(() => {
    setPendingPlan(null);
    setPlanCancelled(false);
  }, [contextKey]);

  const setMode = useCallback(
    (next: ExecutionMode) => {
      if (contextKey) composerDraftStore.setMode(contextKey, next);
    },
    [contextKey],
  );

  const beginPlan = useCallback(
    (goalText: string, resources: ComposerResourceSnapshot): PlanSnapshot => {
      const snapshot: PlanSnapshot = {
        contextKey,
        goalText,
        resources,
        fingerprint: computePlanFingerprint(goalText, resources),
      };
      setPendingPlan(snapshot);
      setPlanCancelled(false);
      return snapshot;
    },
    [contextKey],
  );

  const confirmPlan = useCallback(
    (
      currentGoalText: string,
      currentResources: ComposerResourceSnapshot,
      execute: () => void,
    ): boolean => {
      if (!pendingPlan) return false;
      const currentFingerprint = computePlanFingerprint(
        currentGoalText,
        currentResources,
      );
      if (currentFingerprint !== pendingPlan.fingerprint) {
        return false;
      }
      setPendingPlan(null);
      setPlanCancelled(false);
      execute();
      return true;
    },
    [pendingPlan],
  );

  const cancelPlan = useCallback(() => {
    setPendingPlan(null);
    setPlanCancelled(true);
  }, []);

  const clearPlanFeedback = useCallback(() => setPlanCancelled(false), []);

  return useMemo(
    () => ({
      mode,
      setMode,
      pendingPlan,
      planCancelled,
      beginPlan,
      confirmPlan,
      cancelPlan,
      clearPlanFeedback,
    }),
    [
      mode,
      setMode,
      pendingPlan,
      planCancelled,
      beginPlan,
      confirmPlan,
      cancelPlan,
      clearPlanFeedback,
    ],
  );
}
