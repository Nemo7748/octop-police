import { describe, expect, it, vi } from "vitest";

import type { RecommendedSkill } from "../hooks/usePoliceHomeCatalog";
import {
  launchRecommendedSkill,
  type SkillLaunchContext,
} from "./policeSkillLaunch";

function skill(slug = "police-ppt-generation"): RecommendedSkill {
  return {
    slug,
    name: `技能 ${slug}`,
    description: "",
    emoji: null,
    homeOrder: 1,
    homePrompt: { zh: `提示 ${slug}`, en: `Prompt ${slug}` },
    homeColor: "#cc0000",
    homeIconName: "presentation",
  };
}

function spec(slug: string, enabled: boolean) {
  return { slug, name: slug, enabled, description: "", emoji: null };
}

function setup(overrides: Partial<SkillLaunchContext> = {}) {
  const onSkillsChange = vi.fn();
  const prefillComposer = vi.fn();
  const ctx: SkillLaunchContext = {
    lang: "zh",
    agentId: "agent-1",
    chatSkills: [spec("police-ppt-generation", true)],
    onSkillsChange,
    prefillComposer,
    ...overrides,
  };
  return { ctx, onSkillsChange, prefillComposer };
}

describe("launchRecommendedSkill", () => {
  it("有效技能：本轮选择替换为该 slug 并预填本地化提示（prefilled）", () => {
    const { ctx, onSkillsChange, prefillComposer } = setup();
    const outcome = launchRecommendedSkill(skill(), ctx);
    expect(outcome).toEqual({
      kind: "prefilled",
      slug: "police-ppt-generation",
    });
    expect(onSkillsChange).toHaveBeenCalledTimes(1);
    expect(onSkillsChange).toHaveBeenCalledWith(["police-ppt-generation"]);
    expect(prefillComposer).toHaveBeenCalledTimes(1);
    expect(prefillComposer).toHaveBeenCalledWith("提示 police-ppt-generation");
  });

  it("无当前实例：unavailable 且零副作用（不误用空数组语义）", () => {
    const { ctx, onSkillsChange, prefillComposer } = setup({
      agentId: null,
    });
    const outcome = launchRecommendedSkill(skill(), ctx);
    expect(outcome).toEqual({ kind: "unavailable", reason: "no-agent" });
    expect(onSkillsChange).not.toHaveBeenCalled();
    expect(prefillComposer).not.toHaveBeenCalled();
  });

  it("实例切换后旧 slug 不存在：unavailable(skill-missing) 且零副作用", () => {
    const { ctx, onSkillsChange, prefillComposer } = setup({
      agentId: "agent-2",
      chatSkills: [spec("police-dossier-review", true)],
    });
    const outcome = launchRecommendedSkill(skill("police-ppt-generation"), ctx);
    expect(outcome).toEqual({
      kind: "unavailable",
      reason: "skill-missing",
    });
    expect(onSkillsChange).not.toHaveBeenCalled();
    expect(prefillComposer).not.toHaveBeenCalled();
  });

  it("技能被禁用：unavailable(skill-disabled) 且不修改全局启停、零副作用", () => {
    const { ctx, onSkillsChange, prefillComposer } = setup({
      chatSkills: [spec("police-ppt-generation", false)],
    });
    const outcome = launchRecommendedSkill(skill(), ctx);
    expect(outcome).toEqual({
      kind: "unavailable",
      reason: "skill-disabled",
    });
    expect(onSkillsChange).not.toHaveBeenCalled();
    expect(prefillComposer).not.toHaveBeenCalled();
  });

  it("en 语言预填英文提示语", () => {
    const { ctx, prefillComposer } = setup({ lang: "en" });
    launchRecommendedSkill(skill(), ctx);
    expect(prefillComposer).toHaveBeenCalledWith("Prompt police-ppt-generation");
  });

  it("预填后输入区可修改：推送文本即返回，不触发发送（Mock WS 零调用）", () => {
    const wsCtor = vi.fn();
    vi.stubGlobal("WebSocket", wsCtor);
    try {
      const { ctx } = setup();
      const outcome = launchRecommendedSkill(skill(), ctx);
      expect(outcome.kind).toBe("prefilled");
      expect(wsCtor).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});