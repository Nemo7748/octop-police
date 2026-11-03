/**
 * PoliceBuddy agent-launch controller (spec §2.1.3.D).
 *
 * Decides what a home-catalog agent card click means given the user's
 * existing instances: open the shared CreateFromExpertDrawer when no
 * instance exists, reuse a single running instance, ask the user to pick
 * one when several exist, or fall through to the existing not-ready
 * guidance for stopped/failed instances. Navigation itself is delegated
 * to `openNewSession` (the Chat page owns thread/reset semantics); the
 * quick prompt travels as router state and is never auto-sent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isAgentFailed, isAgentStopped } from "../../../utils/agentError";
import { pickLocale } from "../../../utils/localizedText";
import type { ExpertSummary } from "../../Experts/components/ExpertCard";
import type {
  AgentInstanceSummary,
  PoliceAgentSummary,
} from "./usePoliceHomeCatalog";

/** Discriminated outcome of a home-catalog agent card click. */
export type AgentLaunchResult =
  | { kind: "created"; agentId: string }
  | { kind: "reused"; agentId: string }
  | {
      kind: "selection-required";
      templateId: string;
      instances: readonly AgentInstanceSummary[];
    }
  | { kind: "unavailable"; agentId: string; state: string }
  | { kind: "failed"; reason: "cancelled" };

export interface PendingAgentSelection {
  readonly template: PoliceAgentSummary;
  readonly instances: readonly AgentInstanceSummary[];
}

export interface UsePoliceAgentLaunchParams {
  readonly lang: "zh" | "en";
  readonly agentsByTemplate: ReadonlyMap<
    string,
    readonly AgentInstanceSummary[]
  >;
  /** Navigate to the agent's *new* session, prefilling the composer via router state. */
  readonly openNewSession: (agentId: string, prefill: string) => void;
  /** Refresh the instances source after a template instance is created. */
  readonly reloadInstances: () => void;
}

export interface PoliceAgentLaunchController {
  launchAgentTemplate(item: PoliceAgentSummary): Promise<AgentLaunchResult>;
  launchingAgentId: string | null;
  drawerExpert: ExpertSummary | null;
  drawerOpen: boolean;
  closeDrawer: () => void;
  handleDrawerCreated: (agentId: string, agentName: string) => void;
  pendingSelection: PendingAgentSelection | null;
  chooseInstance: (instance: AgentInstanceSummary) => void;
  cancelSelection: () => void;
}

function firstQuickPromptText(
  item: PoliceAgentSummary,
  lang: "zh" | "en",
): string {
  return pickLocale(item.quickPrompts[0]?.prompt, lang);
}

function toExpertSummary(item: PoliceAgentSummary): ExpertSummary {
  return {
    id: item.expertId,
    label: { zh: item.label.zh, en: item.label.en },
    description: { zh: item.description.zh, en: item.description.en },
    icon_name: item.iconName,
    color: item.color,
  };
}

function isUsableInstance(state: string): boolean {
  return !isAgentStopped(state) && !isAgentFailed(state);
}

export function usePoliceAgentLaunch(
  params: UsePoliceAgentLaunchParams,
): PoliceAgentLaunchController {
  const { lang, agentsByTemplate, openNewSession, reloadInstances } = params;

  const [launchingAgentId, setLaunchingAgentId] = useState<string | null>(null);
  const [drawerExpert, setDrawerExpert] = useState<ExpertSummary | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<PendingAgentSelection | null>(null);

  // Keeps the in-flight launch flow alive across renders; the drawer and
  // instance-selector flows resolve their promise from user callbacks.
  const pendingRef = useRef<{
    resolve: (result: AgentLaunchResult) => void;
    template: PoliceAgentSummary;
  } | null>(null);

  const settle = useCallback((result: AgentLaunchResult) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setLaunchingAgentId(null);
    setDrawerExpert(null);
    setPendingSelection(null);
    pending?.resolve(result);
  }, []);

  // Never leave a hanging promise behind when the owning page unmounts.
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.resolve({ kind: "failed", reason: "cancelled" });
    };
  }, []);

  const launchAgentTemplate = useCallback(
    (item: PoliceAgentSummary): Promise<AgentLaunchResult> => {
      return new Promise((resolve) => {
        // A previous flow should always have settled before a new click
        // (the launcher disables the card while launchingAgentId is set);
        // resolve defensively so no promise is left hanging.
        pendingRef.current?.resolve({ kind: "failed", reason: "cancelled" });
        pendingRef.current = { resolve, template: item };
        setLaunchingAgentId(item.expertId);

        const instances = agentsByTemplate.get(item.expertId) ?? [];
        if (instances.length === 0) {
          setDrawerExpert(toExpertSummary(item));
          return;
        }
        if (instances.length > 1) {
          setPendingSelection({ template: item, instances });
          setLaunchingAgentId(null);
          // The promise settles immediately — the user's later choice or
          // cancellation flows through chooseInstance/cancelSelection.
          // pendingRef keeps `template` so those callbacks can still read
          // the quick prompt; re-resolving a settled promise is a no-op.
          resolve({
            kind: "selection-required",
            templateId: item.expertId,
            instances,
          });
          return;
        }
        const only = instances[0]!;
        if (!isUsableInstance(only.state)) {
          openNewSession(only.agentId, "");
          settle({
            kind: "unavailable",
            agentId: only.agentId,
            state: only.state,
          });
          return;
        }
        openNewSession(only.agentId, firstQuickPromptText(item, lang));
        settle({ kind: "reused", agentId: only.agentId });
      });
    },
    [agentsByTemplate, lang, openNewSession, settle],
  );

  const closeDrawer = useCallback(() => {
    settle({ kind: "failed", reason: "cancelled" });
  }, [settle]);

  const handleDrawerCreated = useCallback(
    (agentId: string) => {
      const template = pendingRef.current?.template ?? null;
      const prefill = template ? firstQuickPromptText(template, lang) : "";
      reloadInstances();
      openNewSession(agentId, prefill);
      settle({ kind: "created", agentId });
    },
    [lang, openNewSession, reloadInstances, settle],
  );

  const chooseInstance = useCallback(
    (instance: AgentInstanceSummary) => {
      const template = pendingRef.current?.template;
      if (!template) return;
      if (!isUsableInstance(instance.state)) {
        openNewSession(instance.agentId, "");
        settle({
          kind: "unavailable",
          agentId: instance.agentId,
          state: instance.state,
        });
        return;
      }
      openNewSession(instance.agentId, firstQuickPromptText(template, lang));
      settle({ kind: "reused", agentId: instance.agentId });
    },
    [lang, openNewSession, settle],
  );

  const cancelSelection = useCallback(() => {
    settle({ kind: "failed", reason: "cancelled" });
  }, [settle]);

  return {
    launchAgentTemplate,
    launchingAgentId,
    drawerExpert,
    drawerOpen: drawerExpert !== null,
    closeDrawer,
    handleDrawerCreated,
    pendingSelection,
    chooseInstance,
    cancelSelection,
  };
}