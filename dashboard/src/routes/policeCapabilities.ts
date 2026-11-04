export type PoliceCapabilityId =
  | "new-task"
  | "assistants"
  | "projects"
  | "experts"
  | "skills"
  | "connectors"
  | "cron"
  | "library"
  | "channels"
  | "subagents"
  | "memory"
  | "token-usage"
  | "acp"
  | "terminal"
  | "remote-browser"
  | "remote-desktop"
  | "mbti"
  | "models"
  | "settings"
  | "admin-users"
  | "admin-storage"
  | "admin-audit"
  | "admin-plugins"
  | "admin-security"
  | "admin-updates"
  | "police-maker"
  | "web-workbench"
  | "messages";

export type PoliceLayout = "workbench" | "capability";
export type PoliceContextRequirement = "none" | "agent" | "task";
export type WorkbenchIntent =
  | "new-task"
  | "projects"
  | "library"
  | "focus-composer";

export interface WorkbenchNavigationState {
  readonly workbenchIntent?: WorkbenchIntent;
  readonly prefillInput?: string;
}

export interface PoliceCapability {
  readonly capabilityId: PoliceCapabilityId;
  readonly path: string;
  readonly layout: PoliceLayout;
  readonly requiredRole: "user" | "admin";
  readonly contextRequirement: PoliceContextRequirement;
  readonly available: boolean;
  readonly selectedKey: string;
}

export interface PoliceNavigationRequest {
  readonly sourceEntry: string;
  readonly capabilityId: PoliceCapabilityId;
  readonly intent?: WorkbenchIntent;
}

export type PoliceNavigationResult =
  | { readonly status: "navigated"; readonly path: string }
  | { readonly status: "unavailable" | "forbidden" | "context-required" };

export interface NavigationDiagnostic {
  readonly sourceEntry: string;
  readonly capabilityId: PoliceCapabilityId | "unknown";
  readonly result: PoliceNavigationResult["status"] | "load-failed";
  readonly reason?: string;
}

export interface PoliceNavigationController {
  readonly navigate: (
    request: PoliceNavigationRequest,
  ) => PoliceNavigationResult;
  readonly resolvePath: (pathname: string) => PoliceCapability | null;
}

export const POLICE_CAPABILITIES: readonly PoliceCapability[] = [
  {
    capabilityId: "assistants",
    path: "/chat",
    layout: "workbench",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "chat",
  },
  {
    capabilityId: "projects",
    path: "/chat",
    layout: "workbench",
    requiredRole: "user",
    contextRequirement: "agent",
    available: true,
    selectedKey: "chat",
  },
  {
    capabilityId: "experts",
    path: "/experts",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "experts",
  },
  {
    capabilityId: "skills",
    path: "/skills",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "skills",
  },
  {
    capabilityId: "connectors",
    path: "/connectors",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "connectors",
  },
  {
    capabilityId: "cron",
    path: "/tasks",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "tasks",
  },
  {
    capabilityId: "library",
    path: "/chat",
    layout: "workbench",
    requiredRole: "user",
    contextRequirement: "agent",
    available: true,
    selectedKey: "chat",
  },
  {
    capabilityId: "channels",
    path: "/channels",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "channels",
  },
  {
    capabilityId: "subagents",
    path: "/subagents",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "subagents",
  },
  {
    capabilityId: "memory",
    path: "/memory",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "memory",
  },
  {
    capabilityId: "token-usage",
    path: "/token-usage",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "token-usage",
  },
  {
    capabilityId: "acp",
    path: "/acp",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "acp",
  },
  {
    capabilityId: "terminal",
    path: "/terminal",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "terminal",
  },
  {
    capabilityId: "remote-browser",
    path: "/remote-browser",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "remote-browser",
  },
  {
    capabilityId: "remote-desktop",
    path: "/remote-desktop",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "remote-desktop",
  },
  {
    capabilityId: "mbti",
    path: "/mbti",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "mbti",
  },
  {
    capabilityId: "models",
    path: "/admin/models",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "models",
  },
  {
    capabilityId: "settings",
    path: "/admin/advanced",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-advanced",
  },
  {
    capabilityId: "admin-users",
    path: "/admin/users",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-users",
  },
  {
    capabilityId: "admin-storage",
    path: "/admin/backend",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-storage",
  },
  {
    capabilityId: "admin-audit",
    path: "/admin/audit",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-audit",
  },
  {
    capabilityId: "admin-plugins",
    path: "/admin/plugins",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-plugins",
  },
  {
    capabilityId: "admin-security",
    path: "/admin/security",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-security",
  },
  {
    capabilityId: "admin-updates",
    path: "/admin/updates",
    layout: "capability",
    requiredRole: "admin",
    contextRequirement: "none",
    available: true,
    selectedKey: "admin-updates",
  },
  {
    capabilityId: "messages",
    path: "/chat",
    layout: "workbench",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "chat",
  },
  {
    capabilityId: "web-workbench",
    path: "/chat",
    layout: "workbench",
    requiredRole: "user",
    contextRequirement: "agent",
    available: true,
    selectedKey: "chat",
  },
  {
    capabilityId: "police-maker",
    path: "/experts",
    layout: "capability",
    requiredRole: "user",
    contextRequirement: "none",
    available: true,
    selectedKey: "experts",
  },
  {
    capabilityId: "new-task",
    path: "/chat",
    layout: "workbench",
    requiredRole: "user",
    contextRequirement: "agent",
    available: true,
    selectedKey: "chat",
  },
];

export function buildNewTaskPath(agentId: string): string | null {
  const normalizedAgentId = agentId.trim();
  return normalizedAgentId ? `/chat/${normalizedAgentId}?new=1` : null;
}

export function isExplicitNewTask(search: string): boolean {
  return new URLSearchParams(search).get("new") === "1";
}

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function getPoliceCapability(
  capabilityId: PoliceCapabilityId,
): PoliceCapability | null {
  return (
    POLICE_CAPABILITIES.find(
      (capability) => capability.capabilityId === capabilityId,
    ) ?? null
  );
}

export function resolvePoliceCapability(
  pathname: string,
): PoliceCapability | null {
  const normalized = normalizePathname(pathname);
  if (normalized === "/chat" || normalized.startsWith("/chat/")) {
    return getPoliceCapability("assistants");
  }
  return (
    POLICE_CAPABILITIES.find(
      (capability) => capability.path === normalized,
    ) ?? null
  );
}

export function isPoliceWorkbenchPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === "/chat" || normalized.startsWith("/chat/");
}