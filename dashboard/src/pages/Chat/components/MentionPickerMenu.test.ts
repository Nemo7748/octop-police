import { describe, expect, it } from "vitest";
import { buildMentionItems } from "./MentionPickerMenu";

describe("buildMentionItems 文件候选", () => {
  const files = [
    { path: "inbound/a.md", name: "a.md", kind: "file" as const },
    {
      path: "outbound/report.docx",
      name: "report.docx",
      kind: "file" as const,
    },
  ];
  const skills = [
    { slug: "s1", name: "技能一", enabled: true },
    { slug: "s2", name: "停用技能", enabled: false },
  ];

  it("文件组置于技能、连接器和 Agent 之前", () => {
    const items = buildMentionItems(
      "",
      skills as never,
      [{ mcp_server_name: "c1", label: "连接器一", kind: "k" }],
      [{ agent_id: "a2", name: "协作 Agent" } as never],
      files,
    );
    expect(items.map((item) => item.kind)).toEqual([
      "file",
      "file",
      "skill",
      "connector",
      "agent",
    ]);
  });

  it("支持名称与路径筛选", () => {
    expect(
      buildMentionItems("report", [], [], [], files).map((i) => i.kind),
    ).toEqual(["file"]);
    expect(buildMentionItems("outbound", [], [], [], files)).toHaveLength(1);
    expect(buildMentionItems("不存在", [], [], [], files)).toHaveLength(0);
  });

  it("停用技能不进入候选", () => {
    const items = buildMentionItems("", skills as never, [], [], []);
    expect(items).toHaveLength(1);
  });
});
