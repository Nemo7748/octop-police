import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chatStore from "./chatStore";

type WsHandler = ((event?: unknown) => void) | null;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: WsHandler = null;
  onmessage: WsHandler = null;
  onerror: WsHandler = null;
  onclose: WsHandler = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.onclose?.({});
  });

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

vi.mock("../../../api/config", () => ({
  getApiUrl: (path: string) => `http://localhost:8000/api${path}`,
}));
vi.mock("../../../api/request", () => ({
  getAuthToken: () => "token",
}));
vi.mock("../utils/chatMessages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/chatMessages")>();
  return actual;
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chatStore 真实运行状态", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    chatStore.removeSession("t-status");
    return () => vi.unstubAllGlobals();
  });

  it("初始为 unknown，发送后为 running，done 后为 done", async () => {
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("unknown");
    const promise = chatStore.sendTurn("t-status", "你好", "a1", "");
    await flush();
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("running");
    const ws = MockWebSocket.instances[0]!;
    ws.emit({ type: "done" });
    await promise;
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("done");
  });

  it("error 映射 failed", async () => {
    const promise = chatStore.sendTurn("t-status", "你好", "a1", "");
    await flush();
    const ws = MockWebSocket.instances[0]!;
    ws.emit({ type: "error", message: "boom" });
    await promise;
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("failed");
  });

  it("用户取消显示 cancelled 而非成功", async () => {
    const promise = chatStore.sendTurn("t-status", "你好", "a1", "");
    await flush();
    chatStore.cancelStream("t-status");
    await promise;
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("cancelled");
  });

  it("断连未完成不伪装成功", async () => {
    const promise = chatStore.sendTurn("t-status", "你好", "a1", "");
    await flush();
    const ws = MockWebSocket.instances[0]!;
    ws.onclose?.({});
    await promise;
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("unknown");
  });

  it("清空会话恢复 unknown", async () => {
    const promise = chatStore.sendTurn("t-status", "你好", "a1", "");
    await flush();
    chatStore.cancelStream("t-status");
    await promise;
    chatStore.clearMessages("t-status");
    expect(chatStore.getSnapshot("t-status").runStatus).toBe("unknown");
  });
});
