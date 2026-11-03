import { describe, expect, it } from "vitest";
import {
  conversationFileCandidates,
  entryDirectoryPath,
  entryToArtifact,
  findDefaultReadme,
  shouldRecurseDirectory,
  WORKSPACE_INDEX_MAX_DEPTH,
} from "./workspaceIndex";
import type { WorkspaceArtifact } from "../workbenchTypes";

describe("workspaceIndex", () => {
  it("目录不计数，文件规范化为产物", () => {
    expect(
      entryToArtifact({ name: "docs", path: "docs", is_dir: true }),
    ).toBeNull();
    const artifact = entryToArtifact({
      name: "a.md",
      path: "./inbound/a.md",
      is_dir: false,
      size: 12,
      modified_time: "2026-01-01",
    });
    expect(artifact?.path).toBe("inbound/a.md");
    expect(artifact?.size).toBe(12);
  });

  it("拒绝非法路径与 ..", () => {
    expect(
      entryToArtifact({ name: "x", path: "../x", is_dir: false }),
    ).toBeNull();
    expect(
      entryToArtifact({ name: "x", path: "file:///etc/x", is_dir: false }),
    ).toBeNull();
  });

  it("目录递归受深度与数量限制", () => {
    expect(shouldRecurseDirectory(0, 0)).toBe(true);
    expect(shouldRecurseDirectory(WORKSPACE_INDEX_MAX_DEPTH, 0)).toBe(false);
    expect(shouldRecurseDirectory(0, 50)).toBe(false);
    expect(entryDirectoryPath({ name: "d", path: "d", is_dir: true })).toBe(
      "d",
    );
    expect(
      entryDirectoryPath({ name: "f", path: "f", is_dir: false }),
    ).toBeNull();
  });

  it("README 优先级：根目录优先，只有真实文件成为候选", () => {
    const artifacts: WorkspaceArtifact[] = [
      {
        path: "docs/README.md",
        name: "README.md",
        size: null,
        modifiedAt: null,
        source: "workspace",
      },
      {
        path: "README.md",
        name: "README.md",
        size: null,
        modifiedAt: null,
        source: "workspace",
      },
    ];
    expect(findDefaultReadme(artifacts)?.path).toBe("README.md");
    expect(findDefaultReadme([artifacts[0]!])?.path).toBe("docs/README.md");
    expect(findDefaultReadme([])).toBeNull();
  });

  it("对话文件候选仅 inbound/outbound 子集", () => {
    const artifacts: WorkspaceArtifact[] = [
      {
        path: "inbound/a.md",
        name: "a.md",
        size: null,
        modifiedAt: null,
        source: "workspace",
      },
      {
        path: "outbound/b.md",
        name: "b.md",
        size: null,
        modifiedAt: null,
        source: "workspace",
      },
      {
        path: "skills/c.md",
        name: "c.md",
        size: null,
        modifiedAt: null,
        source: "workspace",
      },
    ];
    expect(conversationFileCandidates(artifacts)).toHaveLength(2);
  });
});
