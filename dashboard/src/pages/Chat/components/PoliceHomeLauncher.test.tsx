import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { ResourceState } from "../workbenchTypes";
import type {
  PoliceHomeCatalog,
  PoliceHomeSourceKey,
  PoliceHomeSourceStatus,
} from "../hooks/usePoliceHomeCatalog";
import {
  CATALOG_UNSUPPORTED_MARKER,
  type AgentInstanceSummary,
  type PoliceAgentSummary,
  type RecommendedSkill,
} from "../hooks/usePoliceHomeCatalog";
import PoliceHomeLauncher from "./PoliceHomeLauncher";

const DEV_SLUGS = [
  "police-data-dashboard",
  "police-field-offline-collection",
  "police-video-geo-location",
  "police-visual-modeling",
  "police-risk-warning",
];
const WEB_SLUGS = [
  "police-officer-workbench",
  "police-nl-visualization",
  "police-drag-visual-editor",
  "police-multi-device-preview",
  "police-template-market",
  "police-release-review",
];
const SKILL_SLUGS = [
  "police-ppt-generation",
  "police-document-organizing",
  "police-official-drafting",
  "police-legal-regulation-search",
  "police-case-management-webapp",
  "police-dossier-review",
];

function agentSummary(
  expertId: string,
  group: "police-development" | "web-workbench",
  order: number,
): PoliceAgentSummary {
  return {
    expertId,
    label: { zh: `模板 ${expertId}`, en: `Template ${expertId}` },
    description: { zh: `描述 ${expertId}`, en: `Desc ${expertId}` },
    welcomeMessage: { zh: `欢迎 ${expertId}`, en: `Welcome ${expertId}` },
    iconName: "shield",
    color: "#1f6feb",
    group,
    order,
    quickPrompts: [
      {
        title: { zh: "开始", en: "Start" },
        description: { zh: "试试", en: "Try" },
        prompt: { zh: `提示 ${expertId}`, en: `Prompt ${expertId}` },
        color: "#ffffff",
        iconName: "sparkles",
      },
    ],
  };
}

function skillSummary(
  slug: string,
  order: number,
): RecommendedSkill {
  return {
    slug,
    name: `技能 ${slug}`,
    description: `技能描述 ${slug}`,
    emoji: null,
    homeOrder: order,
    homePrompt: { zh: `技能提示 ${order}`, en: `Skill prompt ${order}` },
    homeColor: "#cc0000",
    homeIconName: "presentation",
  };
}

function buildCatalog(): PoliceHomeCatalog {
  const instances: AgentInstanceSummary[] = [
    {
      agentId: "a1",
      name: "实例一",
      state: "running",
      templateName: "police-data-dashboard",
      iconName: null,
      color: null,
    },
  ];
  const agentsByTemplate = new Map<string, AgentInstanceSummary[]>();
  agentsByTemplate.set("police-data-dashboard", instances);
  return {
    agentGroups: [
      {
        group: "police-development",
        agents: DEV_SLUGS.map((slug, i) =>
          agentSummary(slug, "police-development", i + 1),
        ),
      },
      {
        group: "web-workbench",
        agents: WEB_SLUGS.map((slug, i) =>
          agentSummary(slug, "web-workbench", i + 1),
        ),
      },
    ],
    recommendedSkills: SKILL_SLUGS.map((slug, i) => skillSummary(slug, i + 1)),
    agentsByTemplate,
  };
}

const readyState: ResourceState<PoliceHomeCatalog> = {
  status: "ready",
  data: buildCatalog(),
};

function errorState(message: string, retryable: boolean) {
  return {
    status: "error",
    error: { kind: "unavailable", message, retryable },
  } satisfies ResourceState<PoliceHomeCatalog>;
}

const okSources: Record<PoliceHomeSourceKey, PoliceHomeSourceStatus> = {
  templates: "ok",
  instances: "ok",
  skills: "ok",
};

function renderLauncher(
  state: ResourceState<PoliceHomeCatalog> = readyState,
  sourceStatus: Record<PoliceHomeSourceKey, PoliceHomeSourceStatus> = okSources,
  overrides: Partial<Parameters<typeof PoliceHomeLauncher>[0]> = {},
) {
  const onLaunchAgent = vi.fn();
  const onLaunchSkill = vi.fn();
  const onRetry = vi.fn();
  const onRetrySource = vi.fn();
  const utils = render(
    <PoliceHomeLauncher
      state={state}
      sourceStatus={sourceStatus}
      onRetry={onRetry}
      onRetrySource={onRetrySource}
      onLaunchAgent={onLaunchAgent}
      onLaunchSkill={onLaunchSkill}
      launchingAgentId={null}
      {...overrides}
    />,
  );
  return { ...utils, onLaunchAgent, onLaunchSkill, onRetry, onRetrySource };
}

describe("PoliceHomeLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ready 渲染 5+6 智能体卡与 6 技能卡，分组标题顺序正确", () => {
    const { container } = renderLauncher();
    const titles = Array.from(
      container.querySelectorAll(`[class*="groupTitle"]`),
    ).map((el) => el.textContent);
    expect(titles[0]).toBe("policeWorkbench.home.groups.police-development");
    expect(titles[1]).toBe("policeWorkbench.home.groups.web-workbench");
    expect(titles[2]).toBe("policeWorkbench.home.skillsTitle");

    const agentIds = Array.from(
      container.querySelectorAll<HTMLElement>("[data-agent-id]"),
    ).map((el) => el.dataset.agentId);
    expect(agentIds).toHaveLength(11);
    expect(agentIds?.slice(0, 5)).toEqual(DEV_SLUGS);
    expect(agentIds?.slice(5)).toEqual(WEB_SLUGS);

    const skillSlugs = Array.from(
      container.querySelectorAll<HTMLElement>("[data-skill-slug]"),
    ).map((el) => el.dataset.skillSlug);
    expect(skillSlugs).toEqual(SKILL_SLUGS);
  });

  it("loading 渲染骨架且无卡片", () => {
    const { container } = renderLauncher({ status: "loading" });
    expect(
      container.querySelector('[data-testid="police-home-skeleton"]'),
    ).not.toBeNull();
    expect(container.querySelector("[data-agent-id]")).toBeNull();
  });

  it("empty 渲染空态文案", () => {
    renderLauncher({ status: "empty" });
    expect(screen.getByText("policeWorkbench.home.emptyCatalog")).toBeTruthy();
  });

  it("error 显示可重试错误并触发 onRetry", () => {
    const { onRetry } = renderLauncher(
      errorState("templates", true),
    );
    expect(
      screen.getByText("policeWorkbench.home.loadFailed"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("policeWorkbench.home.retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("旧后端降级态显示 catalogUnsupported 且无重试入口", () => {
    const { container } = renderLauncher(
      errorState(CATALOG_UNSUPPORTED_MARKER, false),
    );
    expect(
      screen.getByText("policeWorkbench.home.catalogUnsupported"),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="police-home-unsupported"] button'),
    ).toBeNull();
  });

  it("partial 且技能来源失败：卡片照常渲染，技能区可独立重试", () => {
    const { container, onRetrySource } = renderLauncher(
      {
        status: "partial",
        data: buildCatalog(),
        loadedScope: "templates+instances",
      },
      { templates: "ok", instances: "ok", skills: "error" },
    );
    expect(container.querySelectorAll("[data-agent-id]")).toHaveLength(11);
    expect(
      container.querySelector('[data-testid="home-skills-error"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByText("policeWorkbench.home.retry"));
    expect(onRetrySource).toHaveBeenCalledWith("skills");
  });

  it("partial 且实例来源失败：顶部错误行触发 onRetrySource('instances')", () => {
    const { container, onRetrySource } = renderLauncher(
      {
        status: "partial",
        data: buildCatalog(),
        loadedScope: "templates+skills",
      },
      { templates: "ok", instances: "error", skills: "ok" },
    );
    expect(
      container.querySelector('[data-testid="home-instances-error"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByText("policeWorkbench.home.retry"));
    expect(onRetrySource).toHaveBeenCalledWith("instances");
  });

  it("技能来源就绪但为空时显示 noSkills", () => {
    const catalog = buildCatalog();
    renderLauncher(
      { status: "ready", data: { ...catalog, recommendedSkills: [] } },
    );
    expect(screen.getByText("policeWorkbench.home.noSkills")).toBeTruthy();
  });

  it("点击智能体卡仅触发 onLaunchAgent，不触发技能回调（不自动发消息）", () => {
    const { onLaunchAgent, onLaunchSkill } = renderLauncher();
    fireEvent.click(
      screen.getByText("模板 police-data-dashboard").closest("button")!,
    );
    expect(onLaunchAgent).toHaveBeenCalledTimes(1);
    expect(onLaunchAgent.mock.calls[0]?.[0]?.expertId).toBe(
      "police-data-dashboard",
    );
    expect(onLaunchSkill).not.toHaveBeenCalled();
  });

  it("点击技能卡触发 onLaunchSkill", () => {
    const { onLaunchAgent, onLaunchSkill } = renderLauncher();
    fireEvent.click(
      screen.getByText("技能 police-ppt-generation").closest("button")!,
    );
    expect(onLaunchSkill).toHaveBeenCalledTimes(1);
    expect(onLaunchSkill.mock.calls[0]?.[0]?.slug).toBe("police-ppt-generation");
    expect(onLaunchAgent).not.toHaveBeenCalled();
  });

  it("launchingAgentId 匹配的卡显示创建中并禁用", () => {
    renderLauncher(readyState, okSources, {
      launchingAgentId: "police-data-dashboard",
    });
    const card = screen
      .getByText("模板 police-data-dashboard")
      .closest("button") as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    expect(card.textContent).toContain("policeWorkbench.home.creating");
  });

  it("children 折叠区默认收起，点击 summary 展开", () => {
    const { container } = renderLauncher(readyState, okSources, {
      children: <div data-testid="overview-slot">overview</div>,
    });
    const details = container.querySelector(
      '[data-testid="home-collapse"]',
    ) as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);

    fireEvent.click(details.querySelector("summary")!);
    expect(details.open).toBe(true);
    expect(screen.getByTestId("overview-slot")).toBeTruthy();
  });

  it("超长中英文文案完整渲染不抛错（截断由 CSS line-clamp 承担）", () => {
    const longText = "警".repeat(200);
    const catalog = buildCatalog();
    const agent = {
      ...catalog.agentGroups[0].agents[0],
      label: { zh: longText, en: "A".repeat(200) },
      description: { zh: longText, en: "B".repeat(200) },
    };
    renderLauncher({
      status: "ready",
      data: {
        ...catalog,
        agentGroups: [
          { group: "police-development", agents: [agent] },
          ...catalog.agentGroups.slice(1),
        ],
      },
    });
    expect(screen.getAllByText(longText).length).toBeGreaterThan(0);
  });
});