import { describe, expect, it, vi } from "vitest";
import {
  dedupeReferences,
  groupByParentDirectory,
  parentDirectoryOf,
  referenceToAttachment,
  validateReferencesAgainstListings,
} from "./conversationReferences";

vi.mock("../../../utils/toolMediaBlocks", () => ({
  agentAttachmentAccessUrl: (agentId: string, path: string) =>
    `/api/agents/${agentId}/workspace/media?path=${path}`,
}));

describe("conversationReferences", () => {
  it("父目录解析", () => {
    expect(parentDirectoryOf("inbound/a.md")).toBe("inbound");
    expect(parentDirectoryOf("inbound/sub/a.md")).toBe("inbound/sub");
    expect(parentDirectoryOf("a.md")).toBe(".");
  });

  it("按父目录分组用于发送前刷新验证", () => {
    const groups = groupByParentDirectory([
      { path: "inbound/a.md", name: "a.md", kind: "file" },
      { path: "inbound/b.md", name: "b.md", kind: "file" },
      { path: "outbound/c.md", name: "c.md", kind: "file" },
    ]);
    expect(groups.get("inbound")).toHaveLength(2);
    expect(groups.get("outbound")).toHaveLength(1);
  });

  it("失效与无权引用被区分，其他引用保留", () => {
    const result = validateReferencesAgainstListings(
      [
        { path: "inbound/a.md", name: "a.md", kind: "file" },
        { path: "inbound/missing.md", name: "missing.md", kind: "file" },
        { path: "outbound/c.md", name: "c.md", kind: "file" },
      ],
      new Map([
        ["inbound", [{ name: "a.md", path: "inbound/a.md", is_dir: false }]],
        ["outbound", [{ name: "sub", path: "outbound/sub", is_dir: true }]],
      ]),
    );
    expect(result.valid.map((r) => r.path)).toEqual(["inbound/a.md"]);
    expect(result.invalid.map((r) => r.path)).toEqual([
      "inbound/missing.md",
      "outbound/c.md",
    ]);
  });

  it("任意工作区路径与 file:// 不进入可保真引用", () => {
    expect(
      dedupeReferences([
        { path: "skills/a.md", name: "a.md", kind: "file" },
        { path: "file:///etc/a.md", name: "a.md", kind: "file" },
        { path: "../a.md", name: "a.md", kind: "file" },
        { path: "inbound/ok.md", name: "ok.md", kind: "file" },
      ]),
    ).toEqual([{ path: "inbound/ok.md", name: "ok.md", kind: "file" }]);
  });

  it("引用去重保序", () => {
    const refs = dedupeReferences([
      { path: "inbound/a.md", name: "a.md", kind: "file" },
      { path: "inbound/a.md", name: "a.md", kind: "file" },
      { path: "outbound/b.md", name: "b.md", kind: "file" },
    ]);
    expect(refs).toHaveLength(2);
  });

  it("引用转换为同构 file/image content block 并保留 workspace_path", () => {
    const file = referenceToAttachment("a1", {
      path: "inbound/a.md",
      name: "a.md",
      kind: "file",
    });
    expect(file.kind).toBe("file");
    expect(file.workspacePath).toBe("inbound/a.md");
    expect(file.filename).toBe("a.md");
    const image = referenceToAttachment("a1", {
      path: "outbound/pic.png",
      name: "pic.png",
      kind: "file",
    });
    expect(image.kind).toBe("image");
  });
});
