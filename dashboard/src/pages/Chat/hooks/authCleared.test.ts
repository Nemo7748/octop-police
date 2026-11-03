import { beforeEach, describe, expect, it } from "vitest";
import * as chatStore from "./chatStore";
import {
  clearAllDrafts,
  getSnapshot,
  setReferences,
} from "./composerDraftStore";
import { mapApiErrorKind } from "../utils/workbenchContext";

describe("octop:auth-cleared 认证失效清理", () => {
  beforeEach(() => {
    clearAllDrafts();
    chatStore.clearMessages("t-auth");
    sessionStorage.clear();
  });

  it("清空消息、运行状态、聊天草稿与警务临时状态", () => {
    chatStore.appendUserMessage("t-auth", {
      id: "m1",
      role: "user",
      content: "敏感内容",
      timestamp: Date.now(),
    });
    chatStore.writeInputDraft("a1", "t-auth", "未发送草稿");
    setReferences("a1:t-auth", [
      { path: "inbound/a.md", name: "a.md", kind: "file" },
    ]);
    expect(chatStore.getSnapshot("t-auth").messages).toHaveLength(1);

    window.dispatchEvent(new Event("octop:auth-cleared"));

    expect(chatStore.getSnapshot("t-auth").messages).toHaveLength(0);
    expect(chatStore.getSnapshot("t-auth").runStatus).toBe("unknown");
    expect(chatStore.readInputDraft("a1", "t-auth")).toBe("");
    expect(getSnapshot("a1:t-auth").references).toHaveLength(0);
  });
});

describe("mapApiErrorKind 错误映射", () => {
  it("401/403/404 与其他错误可区分", () => {
    expect(mapApiErrorKind(new Error("Request failed: 401"))).toBe(
      "unauthorized",
    );
    expect(mapApiErrorKind(new Error("Request failed: 403"))).toBe("forbidden");
    expect(mapApiErrorKind(new Error("Request failed: 404"))).toBe(
      "unavailable",
    );
    expect(mapApiErrorKind(new Error("Request failed: 500"))).toBe("unknown");
    expect(mapApiErrorKind("network error")).toBe("unknown");
  });
});
