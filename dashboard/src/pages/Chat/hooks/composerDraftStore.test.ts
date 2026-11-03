import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllDrafts,
  clearDraft,
  clearSubmittedSnapshot,
  getSnapshot,
  setAttachments,
  setMode,
  setPendingGuidance,
  setReferences,
  subscribe,
} from "./composerDraftStore";
import type { ChatAttachment } from "./sseHelpers";

const attachment: ChatAttachment = {
  url: "blob:1",
  kind: "file",
  workspacePath: "inbound/a.md",
};

describe("composerDraftStore 任务隔离", () => {
  beforeEach(() => {
    clearAllDrafts();
  });

  it("按 contextKey 隔离引用、附件与模式", () => {
    setReferences("a1:t1", [
      { path: "inbound/a.md", name: "a.md", kind: "file" },
    ]);
    setAttachments("a1:t1", [attachment]);
    setMode("a1:t1", "plan");
    setMode("a1:t2", "ask");

    expect(getSnapshot("a1:t1").references).toHaveLength(1);
    expect(getSnapshot("a1:t1").attachments).toHaveLength(1);
    expect(getSnapshot("a1:t1").mode).toBe("plan");
    expect(getSnapshot("a1:t2").references).toHaveLength(0);
    expect(getSnapshot("a1:t2").attachments).toHaveLength(0);
    expect(getSnapshot("a1:t2").mode).toBe("ask");
  });

  it("新建任务不覆盖其他任务草稿", () => {
    setReferences("a1:__new__", [
      { path: "inbound/new.md", name: "new.md", kind: "file" },
    ]);
    expect(getSnapshot("a1:t1").references).toHaveLength(0);
    clearDraft("a1:__new__");
    expect(getSnapshot("a1:__new__").references).toHaveLength(0);
  });

  it("发送回执只清理已提交快照，保留发送期间新输入", () => {
    const first = { path: "inbound/a.md", name: "a.md", kind: "file" as const };
    const second = {
      path: "inbound/b.md",
      name: "b.md",
      kind: "file" as const,
    };
    setReferences("a1:t1", [first]);
    clearSubmittedSnapshot("a1:t1", {
      references: [first],
      attachments: [attachment],
    });
    setReferences("a1:t1", [first, second]);
    clearSubmittedSnapshot("a1:t1", {
      references: [first],
      attachments: [],
    });
    expect(getSnapshot("a1:t1").references).toEqual([second]);
  });

  it("附件快照清理不影响后添加的附件", () => {
    const other: ChatAttachment = { url: "blob:2", kind: "file" };
    setAttachments("a1:t1", [attachment]);
    clearSubmittedSnapshot("a1:t1", {
      references: [],
      attachments: [attachment],
    });
    setAttachments("a1:t1", [attachment, other]);
    clearSubmittedSnapshot("a1:t1", {
      references: [],
      attachments: [attachment],
    });
    expect(getSnapshot("a1:t1").attachments).toEqual([other]);
  });

  it("补充指导按上下文排队", () => {
    setPendingGuidance("a1:t1", ["补充一"]);
    setPendingGuidance("a1:t1", ["补充一", "补充二"]);
    expect(getSnapshot("a1:t1").pendingGuidance).toEqual(["补充一", "补充二"]);
    expect(getSnapshot("a1:t2").pendingGuidance).toEqual([]);
  });

  it("订阅在上下文变更时通知", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe("a1:t1", listener);
    setMode("a1:t1", "plan");
    setMode("a1:t2", "plan");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setMode("a1:t1", "ask");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
