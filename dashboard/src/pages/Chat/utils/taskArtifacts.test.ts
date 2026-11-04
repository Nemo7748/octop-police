import { describe, expect, it } from "vitest";
import {
  deriveArtifactChangesFromMessages,
  deriveArtifactsFromMessages,
  deriveChangesFromMessages,
  mergeTaskArtifacts,
} from "./taskArtifacts";
import type { ChatMessage } from "../hooks/sseHelpers";
import type { WorkbenchContextKey } from "../workbenchTypes";

function toolMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    role: "tool",
    content: "",
    timestamp: 0,
    ...overrides,
  };
}

describe("taskArtifacts 变更投影", () => {
  it("write 无法确认新增时保守为 write，edit 为修改", () => {
    const changes = deriveChangesFromMessages([
      toolMessage({
        id: "m1",
        toolData: {
          name: "write_file",
          callId: "c1",
          arguments: JSON.stringify({ path: "README.md" }),
        },
      }),
      toolMessage({
        id: "m2",
        toolData: {
          name: "edit_file",
          callId: "c2",
          arguments: JSON.stringify({ path: "a.md" }),
        },
      }),
    ]);
    expect(changes).toHaveLength(2);
    expect(changes[0]?.kind).toBe("write");
    expect(changes[1]?.kind).toBe("edit");
  });

  it("失败工具不产生变更，callId 去重", () => {
    const changes = deriveChangesFromMessages([
      toolMessage({
        id: "m1",
        toolData: {
          name: "write_file",
          callId: "c1",
          errorCode: "E",
          arguments: JSON.stringify({ path: "a.md" }),
        },
      }),
      toolMessage({
        id: "m2",
        toolData: {
          name: "write_file",
          callId: "c2",
          returnCode: 1,
          arguments: JSON.stringify({ path: "b.md" }),
        },
      }),
      toolMessage({
        id: "m3",
        toolData: {
          name: "write_file",
          callId: "c1",
          arguments: JSON.stringify({ path: "c.md" }),
        },
      }),
      toolMessage({
        id: "m4",
        toolData: {
          name: "write_file",
          callId: "c1",
          arguments: JSON.stringify({ path: "c.md" }),
        },
      }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.callId).toBe("c1");
  });

  it("普通助手回复不产生变更", () => {
    expect(
      deriveChangesFromMessages([
        toolMessage({ id: "u1", role: "assistant", content: "已创建 a.md" }),
      ]),
    ).toHaveLength(0);
  });
});

describe("taskArtifacts 产物投影", () => {
  it("附件与工具产物按路径去重", () => {
    const artifacts = deriveArtifactsFromMessages([
      toolMessage({
        id: "u1",
        role: "user",
        attachments: [
          {
            url: "x",
            kind: "file",
            workspacePath: "inbound/a.md",
            filename: "a.md",
          },
        ],
      }),
      toolMessage({
        id: "m2",
        toolData: {
          name: "write_file",
          callId: "c1",
          arguments: JSON.stringify({ path: "inbound/a.md" }),
        },
      }),
    ]);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.path).toBe("inbound/a.md");
  });

  it("file:// 绝对路径不猜测折叠为相对引用", () => {
    const artifacts = deriveArtifactsFromMessages([
      toolMessage({
        id: "m1",
        toolData: {
          name: "write_file",
          callId: "c1",
          arguments: JSON.stringify({ path: "file:///home/x/a.md" }),
        },
      }),
    ]);
    expect(artifacts).toHaveLength(0);
  });

  it("合并空间与任务产物仍按规范化路径去重", () => {
    const merged = mergeTaskArtifacts(
      [
        {
          path: "inbound/a.md",
          name: "a.md",
          size: 1,
          modifiedAt: null,
          source: "workspace",
        },
      ],
      [
        {
          path: "./inbound/a.md",
          name: "a.md",
          size: null,
          modifiedAt: null,
          source: "message",
        },
        {
          path: "outbound/b.md",
          name: "b.md",
          size: null,
          modifiedAt: null,
          source: "tool",
        },
      ],
    );
    expect(merged).toHaveLength(2);
  });
});
describe("deriveArtifactChangesFromMessages 产物变更投影", () => {
  const ctx: WorkbenchContextKey = { agentId: "a1", threadId: "t1" };

  it("streaming 产生 generating，成功终结产生 confirmed(revision 1)", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "streaming",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/report.md" }),
          },
        }),
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/report.md" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(2);
    expect(changes[0]?.phase).toBe("generating");
    expect(changes[0]?.revision).toBeNull();
    expect(changes[1]?.phase).toBe("confirmed");
    expect(changes[1]?.revision).toBe(1);
    for (const c of changes) {
      expect(c.context).toEqual(ctx);
      expect(c.path).toBe("outbound/report.md");
      expect(c.kind).toBe("write");
    }
  });

  it("同路径二次 confirmed revision 递增", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/a.md" }),
          },
        }),
        toolMessage({
          id: "m2",
          status: "done",
          toolData: {
            name: "edit_file",
            callId: "c2",
            arguments: JSON.stringify({ path: "outbound/a.md" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(2);
    expect(changes[0]?.revision).toBe(1);
    expect(changes[1]?.revision).toBe(2);
    expect(changes[1]?.kind).toBe("edit");
  });

  it("delete 工具产生 kind=delete", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "delete_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/old.md" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe("delete");
    expect(changes[0]?.phase).toBe("confirmed");
  });

  it("失败工具不产生 confirmed，但 streaming 仍产生 generating", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "streaming",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/x.md" }),
          },
        }),
        toolMessage({
          id: "m1",
          status: "error",
          toolData: {
            name: "write_file",
            callId: "c1",
            errorCode: "E",
            arguments: JSON.stringify({ path: "outbound/x.md" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]?.phase).toBe("generating");
  });

  it("重复 callId+path+phase 去重", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/d.md" }),
          },
        }),
        toolMessage({
          id: "m2",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/d.md" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(1);
  });

  it("无路径的 Shell 事件不产生变更", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ command: "ls -la" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(0);
  });

  it("忽略清单：SOUL.md / 隐藏文件 / skills/ / _builtin_skills/ / agents/ / inbound/", () => {
    const paths = [
      "SOUL.md",
      ".env",
      "skills/foo/SKILL.md",
      "_builtin_skills/bar/SKILL.md",
      "agents/config.json",
      "inbound/upload.md",
    ];
    const messages = paths.map((p, i) =>
      toolMessage({
        id: `m${i}`,
        status: "done",
        toolData: {
          name: "write_file",
          callId: `c${i}`,
          arguments: JSON.stringify({ path: p }),
        },
      }),
    );
    expect(deriveArtifactChangesFromMessages(messages, ctx)).toHaveLength(0);
  });

  it("图片类型 .png 产生可预览变更", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "outbound/photo.png" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(1);
  });

  it("file:// 绝对路径被拒绝", () => {
    const changes = deriveArtifactChangesFromMessages(
      [
        toolMessage({
          id: "m1",
          status: "done",
          toolData: {
            name: "write_file",
            callId: "c1",
            arguments: JSON.stringify({ path: "file:///home/x/a.md" }),
          },
        }),
      ],
      ctx,
    );
    expect(changes).toHaveLength(0);
  });

  it("支持预览的多种类型均产生变更", () => {
    const paths = [
      "outbound/a.html",
      "outbound/b.py",
      "outbound/c.sql",
      "outbound/d.json",
      "outbound/e.pptx",
      "outbound/f.docx",
      "outbound/g.xlsx",
      "outbound/h.pdf",
    ];
    const messages = paths.map((p, i) =>
      toolMessage({
        id: `m${i}`,
        status: "done",
        toolData: {
          name: "write_file",
          callId: `c${i}`,
          arguments: JSON.stringify({ path: p }),
        },
      }),
    );
    const changes = deriveArtifactChangesFromMessages(messages, ctx);
    expect(changes).toHaveLength(paths.length);
  });
});
