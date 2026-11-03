import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useChatSend } from "./useChatSend";
import * as chatStore from "./chatStore";

vi.mock("./chatStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chatStore")>();
  return { ...actual, sendTurn: vi.fn() };
});

const localStore = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => localStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localStore.set(key, String(value));
  },
  removeItem: (key: string) => {
    localStore.delete(key);
  },
  clear: () => localStore.clear(),
  key: (index: number) => Array.from(localStore.keys())[index] ?? null,
  get length() {
    return localStore.size;
  },
});

const baseParams = {
  resolvedAgentId: "a1",
  activeThreadId: "t1",
  sessions: [],
  messagesLength: 0,
  selectedModel: null,
  selectedConnectors: [],
  selectedSkills: [],
  selectedTargetAgents: [],
  defaultModel: null,
  sendMessage: vi.fn(),
  createSession: vi.fn(),
  renameSession: vi.fn(),
  t: ((key: string) => key) as never,
};

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useChatSend 发送协调", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空提交返回 empty 且不创建会话", async () => {
    const { result } = renderHook(() => useChatSend(baseParams), { wrapper });
    await expect(result.current.handleSend("   ")).resolves.toEqual({
      status: "empty",
    });
    expect(baseParams.sendMessage).not.toHaveBeenCalled();
    expect(baseParams.createSession).not.toHaveBeenCalled();
  });

  it("无 Agent 返回 error", async () => {
    const { result } = renderHook(
      () => useChatSend({ ...baseParams, resolvedAgentId: null }),
      { wrapper },
    );
    const receipt = await result.current.handleSend("你好");
    expect(receipt.status).toBe("error");
  });

  it("现有任务直接 accepted，模型与技能快照到当次 turn", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(
      () =>
        useChatSend({
          ...baseParams,
          sendMessage,
          selectedModel: "m1",
          selectedSkills: ["s1"],
        }),
      { wrapper },
    );
    await expect(result.current.handleSend("你好")).resolves.toEqual({
      status: "accepted",
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]?.[5]).toBe("m1");
    expect(sendMessage.mock.calls[0]?.[7]).toEqual(["s1"]);
  });

  it("新会话创建失败返回 error，不伪装 accepted", async () => {
    const createSession = vi.fn(() => ({
      session: { id: "pending", threadId: "pending" },
      resolvedId: Promise.resolve(""),
    }));
    const { result } = renderHook(
      () =>
        useChatSend({
          ...baseParams,
          activeThreadId: null,
          createSession: createSession as never,
        }),
      { wrapper },
    );
    const receipt = await result.current.handleSend("你好");
    expect(receipt).toEqual({
      status: "error",
      reason: "create-session-failed",
    });
    expect(chatStore.sendTurn).not.toHaveBeenCalled();
  });

  it("新会话创建成功恰好发送一次", async () => {
    const createSession = vi.fn(() => ({
      session: { id: "pending", threadId: "pending" },
      resolvedId: Promise.resolve("t-new"),
    }));
    const { result } = renderHook(
      () =>
        useChatSend({
          ...baseParams,
          activeThreadId: null,
          createSession: createSession as never,
        }),
      { wrapper },
    );
    await expect(result.current.handleSend("你好")).resolves.toEqual({
      status: "accepted",
    });
    expect(chatStore.sendTurn).toHaveBeenCalledTimes(1);
  });
});
