import { describe, expect, it } from "vitest";
import {
  collectionState,
  dedupeArtifacts,
  dedupeChanges,
  emptyTaskBrief,
  errorState,
  hasBriefContent,
  isCompleteState,
  isConversationFilePath,
  isMarkdownPath,
  isReadmePath,
  isSameContext,
  makeContextKey,
  normalizeWorkspacePath,
  parseContextKey,
  resolveRunStatus,
  stateCount,
} from "./workbenchContext";
import type { WorkspaceArtifact } from "../workbenchTypes";

describe("workbenchContext 上下文归属", () => {
  it("任务级键同时包含 agentId 与 threadId", () => {
    expect(makeContextKey({ agentId: "a1", threadId: "t1" })).toBe("a1:t1");
  });

  it("新会话使用明确的新任务键", () => {
    expect(makeContextKey({ agentId: "a1", threadId: null })).toBe(
      "a1:__new__",
    );
  });

  it("parseContextKey 与 makeContextKey 互逆", () => {
    expect(parseContextKey("a1:t1")).toEqual({ agentId: "a1", threadId: "t1" });
    expect(parseContextKey("a1:__new__")).toEqual({
      agentId: "a1",
      threadId: null,
    });
  });

  it("非法键返回 null", () => {
    expect(parseContextKey("no-separator")).toBeNull();
    expect(parseContextKey(":t1")).toBeNull();
    expect(parseContextKey("a1:")).toBeNull();
  });

  it("isSameContext 区分任务与空间", () => {
    expect(
      isSameContext(
        { agentId: "a", threadId: null },
        { agentId: "a", threadId: "t" },
      ),
    ).toBe(false);
    expect(
      isSameContext(
        { agentId: "a", threadId: "t" },
        { agentId: "a", threadId: "t" },
      ),
    ).toBe(true);
    expect(isSameContext(null, null)).toBe(true);
    expect(isSameContext(null, { agentId: "a", threadId: null })).toBe(false);
  });
});

describe("workbenchContext 计数前置状态", () => {
  it("ready 集合返回真实数量", () => {
    expect(stateCount(collectionState([1, 2, 3]))).toBe(3);
  });

  it("空集合返回 0", () => {
    expect(stateCount(collectionState([]))).toBe(0);
  });

  it("错误和部分数据不能转为 0", () => {
    expect(
      stateCount(
        errorState<readonly number[]>({
          kind: "unknown",
          message: "x",
          retryable: true,
        }),
      ),
    ).toBeNull();
    expect(
      stateCount({ status: "partial", data: [1], loadedScope: "1" }),
    ).toBeNull();
    expect(stateCount({ status: "loading" })).toBeNull();
  });

  it("isCompleteState 仅 ready/empty 为完整", () => {
    expect(isCompleteState(collectionState([1]))).toBe(true);
    expect(isCompleteState(collectionState([]))).toBe(true);
    expect(
      isCompleteState({ status: "partial", data: [1], loadedScope: "1" }),
    ).toBe(false);
  });
});

describe("workbenchContext 未知状态", () => {
  it("无法识别的运行状态保持 unknown", () => {
    expect(resolveRunStatus(undefined)).toBe("unknown");
    expect(resolveRunStatus(null)).toBe("unknown");
    expect(resolveRunStatus("weird")).toBe("unknown");
    expect(resolveRunStatus("running")).toBe("running");
    expect(resolveRunStatus("cancelled")).toBe("cancelled");
  });

  it("空摘要无内容", () => {
    expect(hasBriefContent(emptyTaskBrief())).toBe(false);
    expect(
      hasBriefContent({
        delivered: ["a"],
        nextSteps: [],
        requiredMaterials: [],
      }),
    ).toBe(true);
  });
});

describe("workbenchContext 路径归属", () => {
  it("规范化相对路径", () => {
    expect(normalizeWorkspacePath("./inbound//a.md")).toBe("inbound/a.md");
    expect(normalizeWorkspacePath("inbound\\a.md")).toBe("inbound/a.md");
  });

  it("拒绝 ..、绝对路径与 file://", () => {
    expect(normalizeWorkspacePath("../secret")).toBeNull();
    expect(normalizeWorkspacePath("inbound/../secret")).toBeNull();
    expect(normalizeWorkspacePath("file:///etc/passwd")).toBeNull();
    expect(normalizeWorkspacePath("C:\\Windows\\a.md")).toBeNull();
    expect(normalizeWorkspacePath("")).toBeNull();
    expect(normalizeWorkspacePath("/")).toBeNull();
  });

  it("对话文件仅限 inbound/outbound", () => {
    expect(isConversationFilePath("inbound/a.md")).toBe(true);
    expect(isConversationFilePath("outbound/a.md")).toBe(true);
    expect(isConversationFilePath("skills/a.md")).toBe(false);
    expect(isConversationFilePath("inboundx/a.md")).toBe(false);
  });

  it("Markdown 与 README 识别", () => {
    expect(isMarkdownPath("a.MD")).toBe(true);
    expect(isMarkdownPath("a.markdown")).toBe(true);
    expect(isMarkdownPath("a.txt")).toBe(false);
    expect(isReadmePath("README.md")).toBe(true);
    expect(isReadmePath("docs/readme.markdown")).toBe(true);
    expect(isReadmePath("docs/a.md")).toBe(false);
  });

  it("产物按规范化路径去重", () => {
    const artifacts: WorkspaceArtifact[] = [
      {
        path: "./inbound/a.md",
        name: "a.md",
        size: 1,
        modifiedAt: null,
        source: "workspace",
      },
      {
        path: "inbound/a.md",
        name: "a.md",
        size: 1,
        modifiedAt: null,
        source: "message",
      },
      {
        path: "../bad.md",
        name: "bad.md",
        size: 1,
        modifiedAt: null,
        source: "tool",
      },
    ];
    const result = dedupeArtifacts(artifacts);
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("inbound/a.md");
    expect(result[0]?.source).toBe("workspace");
  });

  it("变更按 callId 去重", () => {
    const result = dedupeChanges([
      { callId: "c1", path: "a", kind: "write", occurredAt: null },
      { callId: "c1", path: "a", kind: "edit", occurredAt: null },
      { callId: "c2", path: "b", kind: "delete", occurredAt: null },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.kind).toBe("write");
  });
});
