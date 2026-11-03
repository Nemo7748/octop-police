import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  usePoliceAgentLaunch,
  type AgentLaunchResult,
} from "./usePoliceAgentLaunch";
import type {
  AgentInstanceSummary,
  PoliceAgentSummary,
} from "./usePoliceHomeCatalog";

function agentSummary(expertId: string, withPrompt = true): PoliceAgentSummary {
  return {
    expertId,
    label: { zh: `模板 ${expertId}`, en: `Template ${expertId}` },
    description: { zh: `描述 ${expertId}`, en: `Desc ${expertId}` },
    welcomeMessage: { zh: `欢迎 ${expertId}`, en: `Welcome ${expertId}` },
    iconName: null,
    color: null,
    group: "police-development",
    order: 1,
    quickPrompts: withPrompt
      ? [
          {
            title: { zh: "开始", en: "Start" },
            description: { zh: "", en: "" },
            prompt: { zh: `提示 ${expertId}`, en: `Prompt ${expertId}` },
            color: "#ffffff",
            iconName: null,
          },
        ]
      : [],
  };
}

function instance(agentId: string, state: string): AgentInstanceSummary {
  return {
    agentId,
    name: `实例 ${agentId}`,
    state,
    templateName: "tpl",
    iconName: null,
    color: null,
  };
}

function setup(
  agentsByTemplate: ReadonlyMap<string, readonly AgentInstanceSummary[]>,
) {
  const openNewSession = vi.fn();
  const reloadInstances = vi.fn();
  const { result, unmount } = renderHook(() =>
    usePoliceAgentLaunch({
      lang: "zh",
      agentsByTemplate,
      openNewSession,
      reloadInstances,
    }),
  );
  return { result, openNewSession, reloadInstances, unmount };
}

describe("usePoliceAgentLaunch", () => {
  let wsCtor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    wsCtor = vi.fn();
    vi.stubGlobal("WebSocket", wsCtor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("无实例：打开创建抽屉，创建成功后携带预填导航并返回 created", async () => {
    const { result, openNewSession, reloadInstances } = setup(new Map());
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    expect(result.current.drawerOpen).toBe(true);
    expect(result.current.drawerExpert?.id).toBe("tpl-a");
    expect(result.current.launchingAgentId).toBe("tpl-a");
    expect(openNewSession).not.toHaveBeenCalled();

    act(() => {
      result.current.handleDrawerCreated("agent-1", "实例一");
    });
    const outcome = await promise;
    expect(outcome).toEqual({ kind: "created", agentId: "agent-1" });
    expect(openNewSession).toHaveBeenCalledTimes(1);
    expect(openNewSession).toHaveBeenCalledWith("agent-1", "提示 tpl-a");
    expect(reloadInstances).toHaveBeenCalledTimes(1);
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.launchingAgentId).toBeNull();
  });

  it("无实例：用户关闭抽屉返回 failed(cancelled) 且不导航", async () => {
    const { result, openNewSession } = setup(new Map());
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    act(() => {
      result.current.closeDrawer();
    });
    const outcome = await promise;
    expect(outcome).toEqual({ kind: "failed", reason: "cancelled" });
    expect(openNewSession).not.toHaveBeenCalled();
    expect(result.current.drawerOpen).toBe(false);
  });

  it("恰一 running 实例：直接复用并预填首个 quickPrompt", async () => {
    const map = new Map([["tpl-a", [instance("agent-1", "running")]]]);
    const { result, openNewSession, reloadInstances } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    const outcome = await promise;
    expect(outcome).toEqual({ kind: "reused", agentId: "agent-1" });
    expect(openNewSession).toHaveBeenCalledWith("agent-1", "提示 tpl-a");
    expect(reloadInstances).not.toHaveBeenCalled();
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.pendingSelection).toBeNull();
  });

  it("恰一 stopped 实例：进入未就绪引导（unavailable），不预填", async () => {
    const map = new Map([["tpl-a", [instance("agent-1", "stopped")]]]);
    const { result, openNewSession } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    const outcome = await promise;
    expect(outcome).toEqual({
      kind: "unavailable",
      agentId: "agent-1",
      state: "stopped",
    });
    expect(openNewSession).toHaveBeenCalledWith("agent-1", "");
  });

  it("恰一 failed 实例：同样进入未就绪引导（unavailable）", async () => {
    const map = new Map([["tpl-a", [instance("agent-1", "failed")]]]);
    const { result } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    const outcome = await promise;
    expect(outcome).toEqual({
      kind: "unavailable",
      agentId: "agent-1",
      state: "failed",
    });
  });

  it("多实例：返回 selection-required，等用户明确选择后才导航", async () => {
    const map = new Map([
      [
        "tpl-a",
        [instance("agent-1", "running"), instance("agent-2", "running")],
      ],
    ]);
    const { result, openNewSession } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    const outcome = await promise;
    expect(outcome.kind).toBe("selection-required");
    expect(
      outcome.kind === "selection-required" ? outcome.instances : [],
    ).toHaveLength(2);
    expect(result.current.pendingSelection?.template.expertId).toBe("tpl-a");
    expect(openNewSession).not.toHaveBeenCalled();

    act(() => {
      result.current.chooseInstance(instance("agent-2", "running"));
    });
    expect(openNewSession).toHaveBeenCalledTimes(1);
    expect(openNewSession).toHaveBeenCalledWith("agent-2", "提示 tpl-a");
    expect(result.current.pendingSelection).toBeNull();
  });

  it("多实例：用户选择 stopped 实例走 unavailable，选择器关闭", async () => {
    const map = new Map([
      [
        "tpl-a",
        [instance("agent-1", "running"), instance("agent-2", "stopped")],
      ],
    ]);
    const { result, openNewSession } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    expect((await promise).kind).toBe("selection-required");
    act(() => {
      result.current.chooseInstance(instance("agent-2", "stopped"));
    });
    expect(openNewSession).toHaveBeenCalledTimes(1);
    expect(openNewSession).toHaveBeenCalledWith("agent-2", "");
    expect(result.current.pendingSelection).toBeNull();
    expect(result.current.launchingAgentId).toBeNull();
  });

  it("多实例：用户取消选择关闭选择器且不导航", async () => {
    const map = new Map([
      [
        "tpl-a",
        [instance("agent-1", "running"), instance("agent-2", "running")],
      ],
    ]);
    const { result, openNewSession } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    expect((await promise).kind).toBe("selection-required");
    act(() => {
      result.current.cancelSelection();
    });
    expect(openNewSession).not.toHaveBeenCalled();
    expect(result.current.pendingSelection).toBeNull();
    expect(result.current.launchingAgentId).toBeNull();
  });

  it("模板无 quickPrompts：复用分支预填空字符串", async () => {
    const map = new Map([["tpl-a", [instance("agent-1", "running")]]]);
    const { result, openNewSession } = setup(map);
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a", false));
    });
    await promise;
    expect(openNewSession).toHaveBeenCalledWith("agent-1", "");
  });

  it("五个分支全程不触发 WebSocket（预填不发送）", async () => {
    const map = new Map([
      ["tpl-none", []],
      ["tpl-one", [instance("agent-1", "running")]],
      [
        "tpl-many",
        [instance("agent-2", "running"), instance("agent-3", "running")],
      ],
      ["tpl-stopped", [instance("agent-4", "stopped")]],
    ]);
    const { result } = setup(map);

    let p1!: Promise<AgentLaunchResult>;
    act(() => {
      p1 = result.current.launchAgentTemplate(agentSummary("tpl-none"));
    });
    act(() => {
      result.current.handleDrawerCreated("agent-new", "n");
    });
    await p1;

    let p2!: Promise<AgentLaunchResult>;
    act(() => {
      p2 = result.current.launchAgentTemplate(agentSummary("tpl-one"));
    });
    await p2;

    let p3!: Promise<AgentLaunchResult>;
    act(() => {
      p3 = result.current.launchAgentTemplate(agentSummary("tpl-many"));
    });
    await p3;

    let p4!: Promise<AgentLaunchResult>;
    act(() => {
      p4 = result.current.launchAgentTemplate(agentSummary("tpl-stopped"));
    });
    await p4;

    expect(wsCtor).not.toHaveBeenCalled();
  });

  it("卸载时悬挂的启动 Promise 以 failed(cancelled) 收尾", async () => {
    const { result, unmount } = setup(new Map());
    let promise!: Promise<AgentLaunchResult>;
    act(() => {
      promise = result.current.launchAgentTemplate(agentSummary("tpl-a"));
    });
    unmount();
    const outcome = await promise;
    expect(outcome).toEqual({ kind: "failed", reason: "cancelled" });
  });
});