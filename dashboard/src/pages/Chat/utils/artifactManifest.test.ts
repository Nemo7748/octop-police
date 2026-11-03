import { describe, expect, it } from "vitest";
import {
  ARTIFACT_MANIFEST_FILENAME,
  ARTIFACT_MANIFEST_VERSION,
  isManifestPath,
  parseArtifactManifest,
} from "./artifactManifest";

describe("isManifestPath", () => {
  it("识别 artifact.json 路径", () => {
    expect(isManifestPath("outbound/task-1/artifact.json")).toBe(true);
    expect(isManifestPath("artifact.json")).toBe(false);
    expect(isManifestPath("outbound/task-1/report.md")).toBe(false);
  });

  it("拒绝非法路径", () => {
    expect(isManifestPath("file:///x/artifact.json")).toBe(false);
    expect(isManifestPath("")).toBe(false);
  });
});

describe("parseArtifactManifest", () => {
  const dir = "outbound/task-1";

  it("合法清单解析并返回主产物路径", () => {
    const result = parseArtifactManifest(
      JSON.stringify({
        version: 1,
        primary: "report.pptx",
        artifacts: [
          { path: "report.pptx", title: "报告", kind: "pptx" },
          { path: "data.json", title: "数据" },
        ],
      }),
      dir,
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.manifest.version).toBe(ARTIFACT_MANIFEST_VERSION);
      expect(result.manifest.primary).toBe("report.pptx");
      expect(result.primaryPath).toBe("outbound/task-1/report.pptx");
      expect(result.manifest.artifacts).toHaveLength(2);
    }
  });

  it("畸形 JSON 返回 malformed-json", () => {
    expect(parseArtifactManifest("not json", dir).status).toBe("invalid");
    expect(parseArtifactManifest("{bad", dir)).toMatchObject({
      status: "invalid",
      reason: "malformed-json",
    });
  });

  it("version 不符返回 unsupported-version", () => {
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 2, primary: "a.md" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "unsupported-version" });
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: "1", primary: "a.md" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "unsupported-version" });
  });

  it("primary 缺失或空返回 missing-primary", () => {
    expect(
      parseArtifactManifest(JSON.stringify({ version: 1 }), dir),
    ).toMatchObject({ status: "invalid", reason: "missing-primary" });
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 1, primary: "" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "missing-primary" });
  });

  it("primary 含 .. 返回 primary-escapes-directory", () => {
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 1, primary: "../other/a.md" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "primary-escapes-directory" });
  });

  it("primary 为绝对路径返回 primary-escapes-directory", () => {
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 1, primary: "file:///etc/passwd" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "primary-escapes-directory" });
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 1, primary: "C:/x/a.md" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "primary-escapes-directory" });
  });

  it("artifacts 非数组返回 malformed-artifacts", () => {
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 1, primary: "a.md", artifacts: "x" }),
        dir,
      ),
    ).toMatchObject({ status: "invalid", reason: "malformed-artifacts" });
  });

  it("artifacts 条目过滤掉无 path 的无效项", () => {
    const result = parseArtifactManifest(
      JSON.stringify({
        version: 1,
        primary: "a.md",
        artifacts: [
          { path: "a.md" },
          { title: "no path" },
          null,
          { path: "" },
        ],
      }),
      dir,
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.manifest.artifacts).toHaveLength(1);
    }
  });

  it("artifacts 可省略", () => {
    const result = parseArtifactManifest(
      JSON.stringify({ version: 1, primary: "a.md" }),
      dir,
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.manifest.artifacts).toHaveLength(0);
    }
  });

  it("嵌套子目录内的 primary 合法", () => {
    const result = parseArtifactManifest(
      JSON.stringify({ version: 1, primary: "slides/final.pptx" }),
      dir,
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.primaryPath).toBe("outbound/task-1/slides/final.pptx");
    }
  });

  it("非法 manifestDir 返回 primary-outside-directory", () => {
    expect(
      parseArtifactManifest(
        JSON.stringify({ version: 1, primary: "a.md" }),
        "file:///bad",
      ),
    ).toMatchObject({ status: "invalid", reason: "primary-outside-directory" });
  });
});

describe("ARTIFACT_MANIFEST 常量", () => {
  it("导出预期常量", () => {
    expect(ARTIFACT_MANIFEST_FILENAME).toBe("artifact.json");
    expect(ARTIFACT_MANIFEST_VERSION).toBe(1);
  });
});