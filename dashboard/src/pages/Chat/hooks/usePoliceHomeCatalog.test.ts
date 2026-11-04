import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { request } from "../../../api/request";
import {
  CATALOG_UNSUPPORTED_MARKER,
  isCatalogUnsupported,
  usePoliceHomeCatalog,
} from "./usePoliceHomeCatalog";

vi.mock("../../../api/request", () => ({
  request: vi.fn(),
}));

const mockedRequest = vi.mocked(request);

function expert(
  id: string,
  group: string,
  order: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    label: { zh: `模板 ${id}`, en: `Template ${id}` },
    description: { zh: `描述 ${id}`, en: `Desc ${id}` },
    welcome_message: { zh: `欢迎 ${id}`, en: `Welcome ${id}` },
    icon_name: "shield",
    color: "#1f6feb",
    group,
    order,
    quick_prompts: [
      {
        title: { zh: "开始", en: "Start" },
        description: { zh: "试试", en: "Try" },
        prompt: { zh: `提示 ${id}`, en: `Prompt ${id}` },
        color: "#ffffff",
        icon_name: "sparkles",
      },
    ],
    ...overrides,
  };
}

const DEV_SLUGS = [
  "police-officer-workbench",
  "police-nl-assistant",
  "police-report-materials",
  "police-risk-warning",
  "police-legal-matching",
  "police-missing-children",
  "police-nl-visualization",
];
const WEB_SLUGS = [
  "police-doc-assistant",
  "police-dossier-review",
  "police-incident-analysis",
  "police-data-dashboard",
  "police-briefing-generator",
];

function twelveExperts(): Record<string, unknown>[] {
  return [
    ...DEV_SLUGS.map((slug, i) => expert(slug, "police-development", i + 1)),
    ...WEB_SLUGS.map((slug, i) => expert(slug, "web-workbench", i + 1)),
  ].reverse();
}

function agent(
  agentId: string,
  templateName: string | null,
  state = "running",
): Record<string, unknown> {
  return {
    agent_id: agentId,
    name: `实例 ${agentId}`,
    state,
    template_name: templateName,
  };
}

function skill(
  slug: string,
  order: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    slug,
    name: `技能 ${slug}`,
    description: `desc ${slug}`,
    enabled: true,
    kind: "builtin",
    emoji: "🚓",
    home_entry: {
      order,
      prompt: { zh: `技能提示 ${order}`, en: `Skill prompt ${order}` },
      color: "#cc0000",
      icon_name: "presentation",
    },
    ...overrides,
  };
}

function sixSkills(): Record<string, unknown>[] {
  const slugs = [
    "police-ppt-generation",
    "police-document-organizing",
    "police-official-drafting",
    "police-legal-regulation-search",
    "police-case-management-webapp",
    "police-dossier-review",
  ];
  const rows = slugs.map((slug, i) => skill(slug, i + 1));
  rows.push(skill("xlsx", 9, { kind: "workspace" }));
  rows.push(skill("disabled-skill", 10, { enabled: false }));
  rows.push(skill("no-home", 11, { home_entry: undefined }));
  return rows;
}

type RouteTable = Record<string, unknown | (() => unknown)>;

function setupRoutes(routes: RouteTable): void {
  mockedRequest.mockImplementation(async (path: string) => {
    const hit = routes[path];
    if (hit === undefined) {
      throw new Error(`unexpected request path: ${path}`);
    }
    return typeof hit === "function" ? hit() : hit;
  });
}

function baseRoutes(extras: RouteTable = {}): RouteTable {
  return {
    "/experts": twelveExperts(),
    "/agents": [],
    "/agents/a1/skills": sixSkills(),
    ...extras,
  };
}

describe("usePoliceHomeCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("12 项按后端 group/order 分组排序，技能按 home_entry 过滤排序", async () => {
    setupRoutes(
      baseRoutes({
        "/agents": [
          agent("a1", "police-data-dashboard"),
          agent("a2", "police-data-dashboard", "stopped"),
          agent("a3", "police-nl-visualization"),
        ],
      }),
    );
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const data = result.current.state.data;
    expect(data).toBeDefined();
    if (!data) return;

    expect(data.agentGroups).toHaveLength(2);
    const [dev, web] = data.agentGroups;
    expect(dev.group).toBe("police-development");
    expect(dev.agents.map((a) => a.expertId)).toEqual(DEV_SLUGS);
    expect(web.group).toBe("web-workbench");
    expect(web.agents.map((a) => a.expertId)).toEqual(WEB_SLUGS);

    expect(
      data.agentsByTemplate.get("police-data-dashboard")?.map((a) => a.agentId),
    ).toEqual(["a1", "a2"]);
    expect(
      data.agentsByTemplate.get("police-nl-visualization")?.[0]?.state,
    ).toBe("running");

    expect(data.recommendedSkills.map((s) => s.slug)).toEqual([
      "police-ppt-generation",
      "police-document-organizing",
      "police-official-drafting",
      "police-legal-regulation-search",
      "police-case-management-webapp",
      "police-dossier-review",
    ]);
  });

  it("旧后端缺少 group/order 时返回目录版本不支持降级态", async () => {
    setupRoutes({
      "/experts": twelveExperts().map((row) => {
        const { group, order, ...rest } = row as Record<string, unknown>;
        void group;
        void order;
        return rest;
      }),
      "/agents": [],
      "/agents/a1/skills": [],
    });
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(isCatalogUnsupported(result.current.state)).toBe(true);
    if (result.current.state.status !== "error") return;
    expect(result.current.state.error.retryable).toBe(false);
    expect(result.current.state.error.message).toBe(CATALOG_UNSUPPORTED_MARKER);
  });

  it("templates 失败进入可重试错误，独立重试后恢复", async () => {
    setupRoutes({
      "/experts": () => {
        throw new Error("boom");
      },
      "/agents": [],
      "/agents/a1/skills": [],
    });
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") return;
    expect(result.current.state.error.retryable).toBe(true);
    expect(result.current.state.error.message).toContain("templates");
    expect(result.current.sourceStatus).toEqual({
      templates: "error",
      instances: "ok",
      skills: "ok",
    });

    setupRoutes(baseRoutes());
    await act(async () => {
      result.current.reloadSource("templates");
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
  });

  it("实例来源失败不影响目录展示，进入 partial 且可独立重试", async () => {
    setupRoutes(
      baseRoutes({
        "/agents": () => {
          throw new Error("boom");
        },
      }),
    );
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("partial"));
    if (result.current.state.status !== "partial") return;
    expect(result.current.state.loadedScope).toBe("templates+skills");
    expect(result.current.state.data.agentGroups).toHaveLength(2);
    expect(result.current.state.data.agentsByTemplate.size).toBe(0);

    setupRoutes(
      baseRoutes({ "/agents": [agent("a9", "police-risk-warning")] }),
    );
    await act(async () => {
      result.current.reloadSource("instances");
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(
      result.current.state.data?.agentsByTemplate
        .get("police-risk-warning")
        ?.map((a) => a.agentId),
    ).toEqual(["a9"]);
  });

  it("技能来源失败进入 partial，推荐技能为空且不影响分组", async () => {
    setupRoutes(
      baseRoutes({
        "/agents/a1/skills": () => {
          throw new Error("boom");
        },
      }),
    );
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("partial"));
    if (result.current.state.status !== "partial") return;
    expect(result.current.state.loadedScope).toBe("templates+instances");
    expect(result.current.state.data.recommendedSkills).toEqual([]);
    expect(result.current.state.data.agentGroups).toHaveLength(2);
  });

  it("目录为空返回 empty 态", async () => {
    setupRoutes({ "/experts": [], "/agents": [], "/agents/a1/skills": [] });
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("empty"));
  });

  it("重复 expertId 与缺字段条目被安全过滤", async () => {
    setupRoutes({
      "/experts": [
        expert("dup", "police-development", 1),
        expert("dup", "police-development", 2),
        { id: "no-label", group: "police-development", order: 3 },
        expert("bad-group", "other", 4),
        expert("order-zero", "web-workbench", 0),
        expert("frac-order", "web-workbench", 1.5),
        { group: "police-development", order: 5, label: { zh: "x" } },
      ],
      "/agents": [],
      "/agents/a1/skills": [],
    });
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const groups = result.current.state.data?.agentGroups ?? [];
    expect(groups).toHaveLength(1);
    const dev = groups.find((g) => g.group === "police-development");
    expect(dev?.agents.map((a) => a.expertId)).toEqual(["dup"]);
    expect(groups.find((g) => g.group === "web-workbench")).toBeUndefined();
  });

  it("无激活实例时不请求技能且推荐为空", async () => {
    setupRoutes(baseRoutes());
    const { result } = renderHook(() => usePoliceHomeCatalog(null));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.state.data?.recommendedSkills).toEqual([]);
    expect(result.current.sourceStatus.skills).toBe("ok");
    expect(
      mockedRequest.mock.calls.every(
        (call) => !String(call[0]).includes("/skills"),
      ),
    ).toBe(true);
  });

  it("切换实例后丢弃旧实例的迟到技能响应", async () => {
    let resolveA1: (value: unknown) => void = () => undefined;
    mockedRequest.mockImplementation(async (path: string) => {
      if (path === "/agents/a1/skills") {
        return await new Promise((resolve) => {
          resolveA1 = resolve;
        });
      }
      if (path === "/agents/a2/skills") return sixSkills();
      if (path === "/experts") return twelveExperts();
      if (path === "/agents") return [];
      throw new Error(`unexpected request path: ${path}`);
    });
    const { result, rerender } = renderHook(
      ({ agentId }) => usePoliceHomeCatalog(agentId),
      { initialProps: { agentId: "a1" as string | null } },
    );
    rerender({ agentId: "a2" });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const before = result.current.state.data?.recommendedSkills.map(
      (s) => s.slug,
    );
    expect(before).toContain("police-ppt-generation");

    await act(async () => {
      resolveA1([skill("late-skill", 1)]);
    });
    expect(
      result.current.state.data?.recommendedSkills.map((s) => s.slug),
    ).toEqual(before);
  });

  it("全部来源失败可整体 reload 恢复", async () => {
    setupRoutes({
      "/experts": () => {
        throw new Error("boom");
      },
      "/agents": () => {
        throw new Error("boom");
      },
      "/agents/a1/skills": () => {
        throw new Error("boom");
      },
    });
    const { result } = renderHook(() => usePoliceHomeCatalog("a1"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.sourceStatus).toEqual({
      templates: "error",
      instances: "error",
      skills: "error",
    });

    setupRoutes(baseRoutes());
    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
  });
});
