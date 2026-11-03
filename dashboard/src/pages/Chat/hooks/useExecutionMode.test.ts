import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { computePlanFingerprint, useExecutionMode } from "./useExecutionMode";
import { clearAllDrafts, setMode } from "./composerDraftStore";
import type { ComposerResourceSnapshot } from "../workbenchTypes";

const resources: ComposerResourceSnapshot = {
  roleAgentId: "a1",
  model: "m1",
  skills: ["s1"],
  connectors: [],
  references: [{ path: "inbound/a.md", name: "a.md", kind: "file" }],
  attachmentCount: 0,
};

describe("useExecutionMode 计划确认保护", () => {
  beforeEach(() => {
    clearAllDrafts();
  });

  it("想一想仅生成本地快照，未确认为零执行", () => {
    const { result } = renderHook(() => useExecutionMode("a1:t1"));
    const execute = vi.fn();
    act(() => {
      result.current.setMode("plan");
    });
    let fingerprint = "";
    act(() => {
      fingerprint = result.current.beginPlan("目标", resources).fingerprint;
    });
    expect(result.current.pendingPlan?.goalText).toBe("目标");
    expect(fingerprint).toBe(computePlanFingerprint("目标", resources));
    expect(execute).not.toHaveBeenCalled();
  });

  it("确认恰好执行一次，重复确认无效", () => {
    const { result } = renderHook(() => useExecutionMode("a1:t1"));
    const execute = vi.fn();
    act(() => {
      result.current.beginPlan("目标", resources);
    });
    let first = false;
    act(() => {
      first = result.current.confirmPlan("目标", resources, execute);
    });
    expect(first).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.current.pendingPlan).toBeNull();
    expect(result.current.confirmPlan("目标", resources, execute)).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("目标或资源变化使计划 stale，不能静默执行", () => {
    const { result } = renderHook(() => useExecutionMode("a1:t1"));
    const execute = vi.fn();
    act(() => {
      result.current.beginPlan("目标", resources);
    });
    expect(result.current.confirmPlan("修改后的目标", resources, execute)).toBe(
      false,
    );
    expect(
      result.current.confirmPlan(
        "目标",
        { ...resources, model: "m2" },
        execute,
      ),
    ).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(result.current.pendingPlan).not.toBeNull();
  });

  it("取消保留草稿且标记计划未执行", () => {
    const { result } = renderHook(() => useExecutionMode("a1:t1"));
    const execute = vi.fn();
    act(() => {
      result.current.beginPlan("目标", resources);
    });
    act(() => {
      result.current.cancelPlan();
    });
    expect(result.current.pendingPlan).toBeNull();
    expect(result.current.planCancelled).toBe(true);
    expect(result.current.confirmPlan("目标", resources, execute)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("上下文切换使待确认计划失效", () => {
    const { result, rerender } = renderHook(
      ({ contextKey }) => useExecutionMode(contextKey),
      { initialProps: { contextKey: "a1:t1" } },
    );
    act(() => {
      result.current.beginPlan("目标", resources);
    });
    rerender({ contextKey: "a1:t2" });
    expect(result.current.pendingPlan).toBeNull();
    const execute = vi.fn();
    expect(result.current.confirmPlan("目标", resources, execute)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("模式按上下文隔离保存", () => {
    setMode("a1:t1", "ask");
    const { result } = renderHook(() => useExecutionMode("a1:t1"));
    expect(result.current.mode).toBe("ask");
    act(() => {
      result.current.setMode("act");
    });
    expect(result.current.mode).toBe("act");
  });
});
