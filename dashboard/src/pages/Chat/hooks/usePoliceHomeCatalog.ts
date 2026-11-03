/**
 * PoliceBuddy home-catalog hook.
 *
 * Merges the three read-only sources the empty-session launcher needs —
 * bundled agent templates (``/experts``), the user's agent instances
 * (``/agents``) and the active instance's skills (``/agents/{id}/skills``) —
 * into one strongly-typed ``PoliceHomeCatalog`` plus a per-source load/retry
 * status. Every DTO passes through a narrowing function at the API boundary;
 * malformed entries are dropped, never rendered. Design: spec §2.1.2 / §2.2.2.D.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../../../api/request";
import type { LocalizedText } from "../../../utils/localizedText";
import type { ResourceError, ResourceState } from "../workbenchTypes";

// ── Public DTOs ───────────────────────────────────────────────────────────

export type PoliceAgentGroup = "police-development" | "web-workbench";

export interface QuickPrompt {
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly prompt: LocalizedText;
  readonly color: string;
  readonly iconName: string | null;
}

/** One home-catalog agent card (narrowed ``GET /experts`` entry). */
export interface PoliceAgentSummary {
  readonly expertId: string;
  readonly label: LocalizedText;
  readonly description: LocalizedText;
  readonly welcomeMessage: LocalizedText;
  readonly iconName: string | null;
  readonly color: string | null;
  readonly group: PoliceAgentGroup;
  readonly order: number;
  readonly quickPrompts: readonly QuickPrompt[];
}

/** One home-recommended builtin skill (narrowed skill summary). */
export interface RecommendedSkill {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string | null;
  readonly homeOrder: number;
  readonly homePrompt: LocalizedText;
  readonly homeColor: string;
  readonly homeIconName: string;
}

/** Narrowed ``GET /agents`` entry — only the fields the launcher needs. */
export interface AgentInstanceSummary {
  readonly agentId: string;
  readonly name: string;
  readonly state: string;
  readonly templateName: string | null;
  readonly iconName: string | null;
  readonly color: string | null;
}

export interface PoliceAgentGroupBucket {
  readonly group: PoliceAgentGroup;
  readonly agents: readonly PoliceAgentSummary[];
}

export interface PoliceHomeCatalog {
  readonly agentGroups: readonly PoliceAgentGroupBucket[];
  readonly recommendedSkills: readonly RecommendedSkill[];
  readonly agentsByTemplate: ReadonlyMap<
    string,
    readonly AgentInstanceSummary[]
  >;
}

export type PoliceHomeSourceKey = "templates" | "instances" | "skills";
export type PoliceHomeSourceStatus = "loading" | "ok" | "error";

/** Stable marker: templates responded but carry no group/order (old backend). */
export const CATALOG_UNSUPPORTED_MARKER = "catalog-unsupported";

export function isCatalogUnsupported(
  state: ResourceState<PoliceHomeCatalog>,
): boolean {
  return (
    state.status === "error" &&
    state.error.message === CATALOG_UNSUPPORTED_MARKER
  );
}

export interface PoliceHomeCatalogResult {
  readonly state: ResourceState<PoliceHomeCatalog>;
  readonly sourceStatus: Record<PoliceHomeSourceKey, PoliceHomeSourceStatus>;
  /** Re-fetch every source. */
  readonly reload: () => void;
  /** Re-fetch a single source (templates | instances | skills). */
  readonly reloadSource: (key: PoliceHomeSourceKey) => void;
}

// ── DTO narrowing ─────────────────────────────────────────────────────────

function asLocalizedText(value: unknown): LocalizedText {
  if (!value || typeof value !== "object") return {};
  const node = value as Record<string, unknown>;
  return {
    zh: typeof node.zh === "string" ? node.zh : undefined,
    en: typeof node.en === "string" ? node.en : undefined,
  };
}

function hasText(text: LocalizedText): boolean {
  return Boolean((text.zh && text.zh.trim()) || (text.en && text.en.trim()));
}

export function narrowQuickPrompt(raw: unknown): QuickPrompt | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Record<string, unknown>;
  const prompt = asLocalizedText(node.prompt);
  if (!hasText(prompt)) return null;
  return {
    title: asLocalizedText(node.title),
    description: asLocalizedText(node.description),
    prompt,
    color:
      typeof node.color === "string" && node.color ? node.color : "#e8f4ff",
    iconName: typeof node.icon_name === "string" ? node.icon_name : null,
  };
}

/** ``None``-like result: the entry is dropped, never an error. */
export function narrowExpertSummary(raw: unknown): PoliceAgentSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Record<string, unknown>;
  const expertId = typeof node.id === "string" ? node.id : "";
  if (!expertId) return null;
  const label = asLocalizedText(node.label);
  if (!hasText(label)) return null;
  if (node.group !== "police-development" && node.group !== "web-workbench") {
    return null;
  }
  const order = node.order;
  if (
    typeof order !== "number" ||
    !Number.isInteger(order) ||
    order < 1
  ) {
    return null;
  }
  const quickPrompts = Array.isArray(node.quick_prompts)
    ? node.quick_prompts
        .map(narrowQuickPrompt)
        .filter((p): p is QuickPrompt => p !== null)
    : [];
  return {
    expertId,
    label,
    description: asLocalizedText(node.description),
    welcomeMessage: asLocalizedText(node.welcome_message),
    iconName: typeof node.icon_name === "string" ? node.icon_name : null,
    color: typeof node.color === "string" ? node.color : null,
    group: node.group,
    order,
    quickPrompts,
  };
}

export function narrowAgentInstance(raw: unknown): AgentInstanceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Record<string, unknown>;
  if (typeof node.agent_id !== "string" || !node.agent_id) return null;
  if (typeof node.name !== "string") return null;
  if (typeof node.state !== "string") return null;
  return {
    agentId: node.agent_id,
    name: node.name,
    state: node.state,
    templateName:
      typeof node.template_name === "string" ? node.template_name : null,
    iconName: typeof node.icon_name === "string" ? node.icon_name : null,
    color: typeof node.color === "string" ? node.color : null,
  };
}

export function narrowRecommendedSkill(raw: unknown): RecommendedSkill | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Record<string, unknown>;
  const slug = typeof node.slug === "string" ? node.slug : "";
  if (!slug) return null;
  if (node.kind !== "builtin" || node.enabled !== true) return null;
  const home = node.home_entry;
  if (!home || typeof home !== "object") return null;
  const homeNode = home as Record<string, unknown>;
  const order = homeNode.order;
  if (typeof order !== "number" || !Number.isInteger(order) || order < 1) {
    return null;
  }
  const prompt = asLocalizedText(homeNode.prompt);
  const color = typeof homeNode.color === "string" ? homeNode.color : "";
  const iconName =
    typeof homeNode.icon_name === "string" ? homeNode.icon_name : "";
  if (!hasText(prompt) || !color.trim() || !iconName.trim()) return null;
  return {
    slug,
    name: typeof node.name === "string" && node.name ? node.name : slug,
    description: typeof node.description === "string" ? node.description : "",
    emoji: typeof node.emoji === "string" ? node.emoji : null,
    homeOrder: order,
    homePrompt: prompt,
    homeColor: color,
    homeIconName: iconName,
  };
}

// ── Pure projections ──────────────────────────────────────────────────────

export function dedupeByExpertId(
  agents: readonly PoliceAgentSummary[],
): PoliceAgentSummary[] {
  const seen = new Set<string>();
  const out: PoliceAgentSummary[] = [];
  for (const agent of agents) {
    if (seen.has(agent.expertId)) continue;
    seen.add(agent.expertId);
    out.push(agent);
  }
  return out;
}

export function buildAgentGroups(
  agents: readonly PoliceAgentSummary[],
): PoliceAgentGroupBucket[] {
  const byGroup: Record<PoliceAgentGroup, PoliceAgentSummary[]> = {
    "police-development": [],
    "web-workbench": [],
  };
  for (const agent of agents) byGroup[agent.group].push(agent);
  const groupOrder: PoliceAgentGroup[] = [
    "police-development",
    "web-workbench",
  ];
  return groupOrder
    .map((group) => ({
      group,
      agents: [...byGroup[group]].sort(
        (a, b) => a.order - b.order || a.expertId.localeCompare(b.expertId),
      ),
    }))
    .filter((bucket) => bucket.agents.length > 0);
}

export function buildAgentsByTemplate(
  instances: readonly AgentInstanceSummary[],
): Map<string, AgentInstanceSummary[]> {
  const map = new Map<string, AgentInstanceSummary[]>();
  for (const instance of instances) {
    if (!instance.templateName) continue;
    const bucket = map.get(instance.templateName);
    if (bucket) bucket.push(instance);
    else map.set(instance.templateName, [instance]);
  }
  return map;
}

/** Narrow + dedupe the raw ``/experts`` payload; ``rawCount`` keeps the pre-filter size. */
export function collectTemplates(rows: unknown): {
  valid: PoliceAgentSummary[];
  rawCount: number;
} {
  const raw = Array.isArray(rows) ? rows : [];
  return {
    valid: dedupeByExpertId(
      raw
        .map(narrowExpertSummary)
        .filter((item): item is PoliceAgentSummary => item !== null),
    ),
    rawCount: raw.length,
  };
}

export function collectAgentInstances(
  rows: unknown,
): AgentInstanceSummary[] {
  return (Array.isArray(rows) ? rows : [])
    .map(narrowAgentInstance)
    .filter((item): item is AgentInstanceSummary => item !== null);
}

export function collectRecommendedSkills(rows: unknown): RecommendedSkill[] {
  return (Array.isArray(rows) ? rows : [])
    .map(narrowRecommendedSkill)
    .filter((item): item is RecommendedSkill => item !== null)
    .sort(
      (a, b) => a.homeOrder - b.homeOrder || a.slug.localeCompare(b.slug),
    );
}

// ── Resource state computation ────────────────────────────────────────────

export interface TemplatesSnapshot {
  readonly status: PoliceHomeSourceStatus;
  readonly valid: readonly PoliceAgentSummary[];
  readonly rawCount: number;
}

export interface ListSnapshot<T> {
  readonly status: PoliceHomeSourceStatus;
  readonly data: readonly T[];
}

function loadError(failedKeys: readonly PoliceHomeSourceKey[]): ResourceError {
  return {
    kind: "unavailable",
    message: failedKeys.join("+"),
    retryable: true,
  };
}

export function computeCatalogState(
  templates: TemplatesSnapshot,
  instances: ListSnapshot<AgentInstanceSummary>,
  skills: ListSnapshot<RecommendedSkill>,
): ResourceState<PoliceHomeCatalog> {
  if (
    templates.status === "loading" ||
    instances.status === "loading" ||
    skills.status === "loading"
  ) {
    return { status: "loading" };
  }

  const failedKeys: PoliceHomeSourceKey[] = [];
  if (templates.status === "error") failedKeys.push("templates");
  if (instances.status === "error") failedKeys.push("instances");
  if (skills.status === "error") failedKeys.push("skills");

  if (templates.status === "error") {
    return { status: "error", error: loadError(failedKeys) };
  }

  // templates.status === "ok" from here on.
  if (templates.rawCount === 0) return { status: "empty" };
  if (templates.valid.length === 0) {
    // Old backend without group/order — the grouped catalog cannot be built.
    return {
      status: "error",
      error: {
        kind: "unavailable",
        message: CATALOG_UNSUPPORTED_MARKER,
        retryable: false,
      },
    };
  }

  const data: PoliceHomeCatalog = {
    agentGroups: buildAgentGroups(templates.valid),
    recommendedSkills: skills.status === "ok" ? skills.data : [],
    agentsByTemplate:
      instances.status === "ok"
        ? buildAgentsByTemplate(instances.data)
        : new Map<string, AgentInstanceSummary[]>(),
  };

  if (failedKeys.length > 0) {
    const loadedKeys: PoliceHomeSourceKey[] = [];
    if (instances.status === "ok") loadedKeys.push("instances");
    if (skills.status === "ok") loadedKeys.push("skills");
    return { status: "partial", data, loadedScope: ["templates", ...loadedKeys].join("+") };
  }
  return { status: "ready", data };
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function usePoliceHomeCatalog(
  agentId: string | null,
): PoliceHomeCatalogResult {
  const [templates, setTemplates] = useState<TemplatesSnapshot>({
    status: "loading",
    valid: [],
    rawCount: 0,
  });
  const [instances, setInstances] = useState<
    ListSnapshot<AgentInstanceSummary>
  >({ status: "loading", data: [] });
  const [skills, setSkills] = useState<ListSnapshot<RecommendedSkill>>({
    status: "loading",
    data: [],
  });

  const [templatesToken, setTemplatesToken] = useState(0);
  const [instancesToken, setInstancesToken] = useState(0);
  const [skillsToken, setSkillsToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await request<unknown[]>("/experts", {
          cache: "no-store",
        });
        if (cancelled) return;
        setTemplates({ status: "ok", ...collectTemplates(rows) });
      } catch {
        if (cancelled) return;
        setTemplates({ status: "error", valid: [], rawCount: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templatesToken]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await request<unknown[]>("/agents", {
          cache: "no-store",
        });
        if (cancelled) return;
        setInstances({ status: "ok", data: collectAgentInstances(rows) });
      } catch {
        if (cancelled) return;
        setInstances({ status: "error", data: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instancesToken]);

  useEffect(() => {
    let cancelled = false;
    if (!agentId) {
      setSkills({ status: "ok", data: [] });
      return;
    }
    void (async () => {
      try {
        const rows = await request<unknown[]>(`/agents/${agentId}/skills`, {
          cache: "no-store",
        });
        if (cancelled) return;
        setSkills({ status: "ok", data: collectRecommendedSkills(rows) });
      } catch {
        if (cancelled) return;
        setSkills({ status: "error", data: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, skillsToken]);

  const reload = useCallback(() => {
    setTemplatesToken((n) => n + 1);
    setInstancesToken((n) => n + 1);
    setSkillsToken((n) => n + 1);
  }, []);

  const reloadSource = useCallback((key: PoliceHomeSourceKey) => {
    if (key === "templates") setTemplatesToken((n) => n + 1);
    else if (key === "instances") setInstancesToken((n) => n + 1);
    else setSkillsToken((n) => n + 1);
  }, []);

  const state = useMemo(
    () => computeCatalogState(templates, instances, skills),
    [templates, instances, skills],
  );

  const sourceStatus = useMemo<
    Record<PoliceHomeSourceKey, PoliceHomeSourceStatus>
  >(
    () => ({
      templates: templates.status,
      instances: instances.status,
      skills: skills.status,
    }),
    [templates, instances, skills],
  );

  return { state, sourceStatus, reload, reloadSource };
}