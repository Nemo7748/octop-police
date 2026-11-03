import { describe, expect, it } from "vitest";
import zh from "./zh.json";
import en from "./en.json";

type LocaleTree = { readonly [key: string]: string | LocaleTree };

function flattenKeys(tree: LocaleTree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result.set(path, value);
    } else {
      for (const [childPath, childValue] of flattenKeys(value, path)) {
        result.set(childPath, childValue);
      }
    }
  }
  return result;
}

function interpolationParams(template: string): string[] {
  return Array.from(template.matchAll(/\{(\w+)\}/g))
    .map((match) => match[1] ?? "")
    .sort();
}

const zhFlat = flattenKeys(
  (zh as Record<string, unknown>).policeWorkbench as LocaleTree,
);
const enFlat = flattenKeys(
  (en as Record<string, unknown>).policeWorkbench as LocaleTree,
);

describe("policeWorkbench 双语键树", () => {
  it("中英文键集合完全一致", () => {
    expect(Array.from(zhFlat.keys()).sort()).toEqual(
      Array.from(enFlat.keys()).sort(),
    );
  });

  it("所有值非空", () => {
    for (const [key, value] of zhFlat) {
      expect(value.trim(), `zh ${key}`).not.toBe("");
    }
    for (const [key, value] of enFlat) {
      expect(value.trim(), `en ${key}`).not.toBe("");
    }
  });

  it("插值参数完全一致", () => {
    for (const [key, zhValue] of zhFlat) {
      const enValue = enFlat.get(key);
      expect(enValue, key).toBeDefined();
      expect(interpolationParams(zhValue), key).toEqual(
        interpolationParams(enValue ?? ""),
      );
    }
  });

  it("中文输入提示明确包含 @ 与 /", () => {
    const placeholder = zhFlat.get("composer.placeholder") ?? "";
    expect(placeholder).toContain("@");
    expect(placeholder).toContain("/");
  });

  it("三种模式、五种运行状态和所有预览状态均有文案", () => {
    for (const mode of ["ask", "act", "plan"]) {
      expect(zhFlat.has(`modes.${mode}`)).toBe(true);
      expect(enFlat.has(`modes.${mode}`)).toBe(true);
    }
    for (const status of [
      "running",
      "done",
      "failed",
      "cancelled",
      "unknown",
    ]) {
      expect(zhFlat.has(`runStatus.${status}`)).toBe(true);
      expect(enFlat.has(`runStatus.${status}`)).toBe(true);
    }
    for (const state of [
      "loading",
      "empty",
      "failed",
      "forbidden",
      "unsupported",
      "renderFailed",
      "manifestPending",
      "manifestInvalid",
    ]) {
      expect(zhFlat.has(`preview.${state}`)).toBe(true);
      expect(enFlat.has(`preview.${state}`)).toBe(true);
    }
  });

  it("不包含固定示例任务数、模型名或警务文件名", () => {
    for (const [key, value] of [...zhFlat, ...enFlat]) {
      expect(value, key).not.toMatch(/DeepSeek|GPT-|Claude/i);
      expect(value, key).not.toMatch(/小程序项目档案|preview\.html/);
      expect(value, key).not.toMatch(
        /任务\(4\)|空间\(11\)|产物\(33\)|变更\(70\)/,
      );
    }
  });

  it("演示数据与人工复核标注及视口切换标签齐备", () => {
    for (const key of ["preview.demoData", "preview.humanReview"]) {
      expect(zhFlat.has(key), key).toBe(true);
      expect(enFlat.has(key), key).toBe(true);
    }
    for (const viewport of ["desktop", "tablet", "mobile"]) {
      expect(zhFlat.has(`preview.viewport.${viewport}`)).toBe(true);
      expect(enFlat.has(`preview.viewport.${viewport}`)).toBe(true);
    }
  });

  it("首页启动器文案齐备", () => {
    for (const key of [
      "home.groups.police-development",
      "home.groups.web-workbench",
      "home.skillsTitle",
      "home.skillsSubtitle",
      "home.noDescription",
      "home.launch",
      "home.creating",
      "home.selectInstance",
      "home.instanceUnavailable",
      "home.agentCreated",
      "home.launchFailed",
      "home.catalogUnsupported",
      "home.loadFailed",
      "home.retry",
      "home.emptyCatalog",
      "home.noSkills",
      "home.skillUnavailable",
      "home.prefillHint",
    ]) {
      expect(zhFlat.has(key), key).toBe(true);
      expect(enFlat.has(key), key).toBe(true);
    }
  });
});
