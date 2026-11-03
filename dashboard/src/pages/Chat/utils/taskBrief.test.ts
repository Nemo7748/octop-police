import { describe, expect, it } from "vitest";
import { extractReadmeSection, projectTaskBrief } from "./taskBrief";

const README = `# 项目档案

## 本次已交付
- 完成小程序首页
- 完成档案结构

## 下次回来做什么
- 接入登录接口

## 需带来的材料
- 接口文档

## 其他说明
- 不应被摘录
`;

describe("taskBrief README 摘要投影", () => {
  it("按完全同名小节摘录", () => {
    expect(extractReadmeSection(README, ["本次已交付"])).toEqual([
      "完成小程序首页",
      "完成档案结构",
    ]);
    expect(extractReadmeSection(README, ["下次回来做什么"])).toEqual([
      "接入登录接口",
    ]);
    expect(extractReadmeSection(README, ["需带来的材料"])).toEqual([
      "接口文档",
    ]);
  });

  it("支持英文同名小节与编号列表", () => {
    const content = "## Next Steps\n1. Step one\n2. Step two\n";
    expect(extractReadmeSection(content, ["Next Steps"])).toEqual([
      "Step one",
      "Step two",
    ]);
  });

  it("缺失小节返回空，不猜测相近标题", () => {
    expect(extractReadmeSection(README, ["下次计划"])).toEqual([]);
    expect(extractReadmeSection("无标题正文", ["本次已交付"])).toEqual([]);
  });

  it("优先使用 README 交付小节", () => {
    const brief = projectTaskBrief(README, [], []);
    expect(brief.delivered).toEqual(["完成小程序首页", "完成档案结构"]);
    expect(brief.nextSteps).toEqual(["接入登录接口"]);
    expect(brief.requiredMaterials).toEqual(["接口文档"]);
  });

  it("无交付小节时仅列真实变更与产物", () => {
    const brief = projectTaskBrief(
      "## 其他\n- x\n",
      [{ callId: "c1", path: "a.md", kind: "write", occurredAt: null }],
      [
        {
          path: "b.md",
          name: "b.md",
          size: null,
          modifiedAt: null,
          source: "workspace",
        },
      ],
    );
    expect(brief.delivered).toEqual(["a.md", "b.md"]);
    expect(brief.nextSteps).toEqual([]);
    expect(brief.requiredMaterials).toEqual([]);
  });

  it("普通对话干扰与无记录状态", () => {
    const brief = projectTaskBrief(null, [], []);
    expect(brief.delivered).toEqual([]);
    expect(brief.nextSteps).toEqual([]);
    expect(brief.requiredMaterials).toEqual([]);
  });
});
