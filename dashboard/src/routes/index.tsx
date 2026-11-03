import { lazy } from "react";
import { Navigate } from "react-router-dom";
import PoliceRouteBoundary from "../components/PoliceRouteBoundary";
import {
  resolvePoliceCapability,
  type PoliceCapabilityId,
  type PoliceLayout,
} from "./policeCapabilities";

// Lazy-loaded pages — Common
const ExpertsPage = lazy(() => import("../pages/Experts"));
const CronJobsPage = lazy(() => import("../pages/Control/CronJobs"));
const ConnectorsPage = lazy(() => import("../pages/Agent/Connectors"));
const ACPPage = lazy(() => import("../pages/Agent/ACP"));
const SkillsPage = lazy(() => import("../pages/Agent/Skills"));
const TokenUsagePage = lazy(() => import("../pages/Control/TokenUsage"));

// Lazy-loaded pages — Control
const ChannelsPage = lazy(() => import("../pages/Control/Channels"));
const RemoteBrowserPage = lazy(() => import("../pages/Control/RemoteBrowser"));
const RemoteDesktopPage = lazy(() => import("../pages/Control/RemoteDesktop"));
const SubagentsPage = lazy(() => import("../pages/Control/Subagents"));
const MBTIPage = lazy(() => import("../pages/Agent/MBTI"));
const MemoryPage = lazy(() => import("../pages/Agent/Memory"));

// Lazy-loaded pages — Settings
const ModelsPage = lazy(() => import("../pages/Settings/Models"));

// Lazy-loaded pages — Admin
const OctopAdminUsersPage = lazy(() => import("../pages/Admin/Users"));
const OctopAdminAuditPage = lazy(() => import("../pages/Admin/Audit"));
const AdminSecurityPage = lazy(() => import("../pages/Settings/Security"));
const AdvancedSettingsPage = lazy(
  () => import("../pages/Settings/AdvancedSettings"),
);
const AdminUpdatesPage = lazy(() => import("../pages/Admin/Updates"));
const AdminStoragePage = lazy(() => import("../pages/Admin/Storage"));
const AdminPluginsPage = lazy(() => import("../pages/Admin/Plugins"));

// Misc
const PwaDebugPage = lazy(() => import("../pages/PwaDebug"));

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  /** When true, the route uses a wrapper component instead of a plain element */
  useWrapper?: boolean;
  capabilityId?: PoliceCapabilityId;
  layout?: PoliceLayout;
}

export const pathToKey: Record<string, string> = {
  "/chat": "chat",
  // Common
  "/experts": "experts",
  "/tasks": "tasks",
  "/connectors": "connectors",
  "/acp": "acp",
  "/skills": "skills",
  "/token-usage": "token-usage",
  // Control
  "/channels": "channels",
  "/terminal": "terminal",
  "/remote-browser": "remote-browser",
  "/remote-desktop": "remote-desktop",
  "/subagents": "subagents",
  "/mbti": "mbti",
  "/memory": "memory",
  // Admin
  "/admin/models": "models",
  "/admin/users": "admin-users",
  "/admin/backend": "admin-storage",
  "/admin/audit": "admin-audit",
  "/admin/plugins": "admin-plugins",
  "/admin/advanced": "admin-advanced",
  "/admin/security": "admin-security",
  "/admin/updates": "admin-updates",
};

/**
 * Pages that should fill the entire content area without padding/scroll wrapper.
 */
export const FULLSCREEN_PATHS = new Set([
  "/terminal",
  "/chat",
  "/remote-browser",
  "/remote-desktop",
]);

/**
 * Pages that provide their own compact mobile header.
 */
export const SELF_HEADER_PATHS = new Set<string>([]);

/** Mobile-only fullscreen pages (custom header + no content padding). */
export const MOBILE_FULLSCREEN_PATHS = new Set(["/subagents"]);

export function resolveSelectedKey(pathname: string): string | null {
  const capability = resolvePoliceCapability(pathname);
  if (capability) return capability.selectedKey;
  return pathToKey[pathname] ?? null;
}

export const routeConfigs: RouteConfig[] = [
  // Chat (handled via ChatWithKey wrapper in MainLayout)
  {
    path: "/chat",
    element: null,
    useWrapper: true,
    capabilityId: "assistants",
    layout: "workbench",
  },
  {
    path: "/chat/:agentId",
    element: null,
    useWrapper: true,
    capabilityId: "assistants",
    layout: "workbench",
  },
  {
    path: "/chat/:agentId/:threadId",
    element: null,
    useWrapper: true,
    capabilityId: "assistants",
    layout: "workbench",
  },

  // Common
  {
    path: "/experts",
    element: <ExpertsPage />,
    capabilityId: "experts",
    layout: "capability",
  },
  {
    path: "/tasks",
    element: <CronJobsPage />,
    capabilityId: "cron",
    layout: "capability",
  },
  {
    path: "/connectors",
    element: <ConnectorsPage />,
    capabilityId: "connectors",
    layout: "capability",
  },
  {
    path: "/acp",
    element: <ACPPage />,
    capabilityId: "acp",
    layout: "capability",
  },
  {
    path: "/skills",
    element: <SkillsPage />,
    capabilityId: "skills",
    layout: "capability",
  },
  {
    path: "/token-usage",
    element: <TokenUsagePage />,
    capabilityId: "token-usage",
    layout: "capability",
  },

  // Control
  {
    path: "/channels",
    element: <ChannelsPage />,
    capabilityId: "channels",
    layout: "capability",
  },
  {
    path: "/remote-browser",
    element: <RemoteBrowserPage />,
    capabilityId: "remote-browser",
    layout: "capability",
  },
  {
    path: "/remote-desktop",
    element: <RemoteDesktopPage />,
    capabilityId: "remote-desktop",
    layout: "capability",
  },
  {
    path: "/subagents",
    element: <SubagentsPage />,
    capabilityId: "subagents",
    layout: "capability",
  },
  {
    path: "/mbti",
    element: <MBTIPage />,
    capabilityId: "mbti",
    layout: "capability",
  },
  {
    path: "/memory",
    element: <MemoryPage />,
    capabilityId: "memory",
    layout: "capability",
  },
  { path: "/workspace", element: <Navigate to="/experts" replace /> },

  // Settings
  {
    path: "/admin/models",
    element: <ModelsPage />,
    capabilityId: "models",
    layout: "capability",
  },

  // Admin (RequireAdmin wrapper applied in MainLayout)
  {
    path: "/admin/users",
    element: <OctopAdminUsersPage />,
    capabilityId: "admin-users",
    layout: "capability",
  },
  {
    path: "/admin/shared-models",
    element: <Navigate to="/admin/models" replace />,
  },
  { path: "/models", element: <Navigate to="/admin/models" replace /> },
  {
    path: "/admin/backend",
    element: <AdminStoragePage />,
    capabilityId: "admin-storage",
    layout: "capability",
  },
  {
    path: "/admin/audit",
    element: <OctopAdminAuditPage />,
    capabilityId: "admin-audit",
    layout: "capability",
  },
  { path: "/admin/agents", element: <Navigate to="/admin/users" replace /> },
  {
    path: "/admin/plugins",
    element: <AdminPluginsPage />,
    capabilityId: "admin-plugins",
    layout: "capability",
  },
  {
    path: "/admin/advanced",
    element: <AdvancedSettingsPage />,
    capabilityId: "settings",
    layout: "capability",
  },
  {
    path: "/admin/security",
    element: <AdminSecurityPage />,
    capabilityId: "admin-security",
    layout: "capability",
  },
  {
    path: "/admin/voice",
    element: <Navigate to="/admin/advanced?tab=voice" replace />,
  },
  {
    path: "/admin/updates",
    element: <AdminUpdatesPage />,
    capabilityId: "admin-updates",
    layout: "capability",
  },

  // Legacy redirects — keeps old bookmarks working
  { path: "/admin/storage", element: <Navigate to="/admin/backend" replace /> },
  { path: "/orca/cron", element: <Navigate to="/tasks" replace /> },
  { path: "/orca/channels", element: <Navigate to="/channels" replace /> },
  {
    path: "/orca/admin/users",
    element: <Navigate to="/admin/users" replace />,
  },
  {
    path: "/orca/admin/audit",
    element: <Navigate to="/admin/audit" replace />,
  },
  { path: "/octop/cron", element: <Navigate to="/tasks" replace /> },
  { path: "/octop/channels", element: <Navigate to="/channels" replace /> },
  {
    path: "/octop/admin/users",
    element: <Navigate to="/admin/users" replace />,
  },
  {
    path: "/octop/admin/audit",
    element: <Navigate to="/admin/audit" replace />,
  },
  {
    path: "/advanced-settings",
    element: <Navigate to="/admin/advanced" replace />,
  },
  { path: "/environments", element: <Navigate to="/admin/advanced" replace /> },
  { path: "/agent-config", element: <Navigate to="/admin/advanced" replace /> },
  { path: "/updates", element: <Navigate to="/admin/updates" replace /> },
  { path: "/personalization", element: <Navigate to="/mbti" replace /> },
  {
    path: "/plugins",
    element: <Navigate to="/admin/plugins?tab=agent-tools" replace />,
  },
  { path: "/sessions", element: <Navigate to="/chat" replace /> },
  { path: "/cron-jobs", element: <Navigate to="/tasks" replace /> },

  // Misc
  { path: "/pwa-debug", element: <PwaDebugPage /> },
  { path: "/", element: <Navigate to="/chat" replace /> },
  {
    path: "*",
    element: <PoliceRouteBoundary status="unavailable" />,
  },
];
