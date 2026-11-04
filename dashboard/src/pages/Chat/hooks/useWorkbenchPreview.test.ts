import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useWorkbenchPreview } from "./useWorkbenchPreview";
import { useChatDockPanel } from "./useChatDockPanel";
import type { ArtifactChange, WorkbenchContextKey } from "../workbenchTypes";

function useDockWithPreview(contextKey: string) {
  const dock = useChatDockPanel(false);
  return useWorkbenchPreview(contextKey, dock);
}

function makeChange(
  path: string,
  phase: "generating" | "confirmed",
  revision: number | null = null,
  callId = "c1",
): ArtifactChange {
  const context: WorkbenchContextKey = { agentId: "a1", threadId: "t1" };
  return {
    context,
    path,
    kind: "write",
    changeKey: `${callId}:${path}:${phase}`,
    occurredAt: null,
    phase,
    revision: phase === "confirmed" ? (revision ?? 1) : null,
  } as ArtifactChange;
}

describe("useWorkbenchPreview", () => {
  it("close 只收起并保留同上下文选择，重开可恢复", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("README.md"));
    expect(result.current.selection?.path).toBe("README.md");
    act(() => result.current.close());
    expect(result.current.selection?.path).toBe("README.md");
  });

  it("clearInvalidSelection 才清除选择", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("README.md"));
    act(() => result.current.clearInvalidSelection());
    expect(result.current.selection).toBeNull();
  });

  it("每个上下文仅保留最近一项，打开与刷新递增 revision", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("a.md"));
    const first = result.current.revision;
    act(() => result.current.open("b.md"));
    expect(result.current.selection?.path).toBe("b.md");
    expect(result.current.revision).toBeGreaterThan(first);
    const before = result.current.revision;
    act(() => result.current.refresh());
    expect(result.current.revision).toBe(before + 1);
  });

  it("useChatDockPanel 原生 close 同样保留选择", () => {
    const { result } = renderHook(() => useChatDockPanel(false));
    act(() => result.current.openFileAt("a.md"));
    act(() => result.current.handleClose());
    expect(result.current.dockOpen).toBe(false);
    expect(result.current.filePath).toBe("a.md");
    act(() => result.current.clearPreviewSelection());
    expect(result.current.filePath).toBeNull();
  });
});

describe("useWorkbenchPreview 状态机", () => {
  it("初始为 follow-latest + idle", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    expect(result.current.mode).toBe("follow-latest");
    expect(result.current.displayStatus).toBe("idle");
    expect(result.current.hasNewArtifact).toBe(false);
  });

  it("follow-latest 防抖后自动打开最新 confirmed 主产物", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => {
      result.current.applyChanges([
        makeChange("outbound/a.md", "confirmed", 1, "c1"),
        makeChange("outbound/b.md", "confirmed", 1, "c2"),
      ]);
    });
    expect(result.current.selection).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.selection?.path).toBe("outbound/b.md");
    expect(result.current.displayStatus).toBe("loading");
    vi.useRealTimers();
  });

  it("仅 generating phase 不触发打开", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => {
      result.current.applyChanges([makeChange("outbound/a.md", "generating")]);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.selection).toBeNull();
    vi.useRealTimers();
  });

  it("open 进入 manual 模式", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    expect(result.current.mode).toBe("manual");
  });

  it("manual 模式当前文件 confirmed 刷新 revision", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    const before = result.current.revision;
    act(() => {
      result.current.applyChanges([
        makeChange("outbound/a.md", "confirmed", 2, "c2"),
      ]);
    });
    expect(result.current.revision).toBe(before + 1);
    expect(result.current.displayStatus).toBe("updating");
    expect(result.current.hasNewArtifact).toBe(false);
  });

  it("manual 模式其他文件 confirmed 设置 hasNewArtifact", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => {
      result.current.applyChanges([
        makeChange("outbound/b.md", "confirmed", 1, "c2"),
      ]);
    });
    expect(result.current.hasNewArtifact).toBe(true);
    expect(result.current.selection?.path).toBe("outbound/a.md");
  });

  it("close 后恢复 follow-latest 会打开最新产物并清除提醒", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => result.current.close());
    act(() => result.current.setFollowLatest());
    act(() => {
      result.current.applyChanges([
        makeChange("outbound/b.md", "confirmed", 1, "c2"),
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.hasNewArtifact).toBe(false);
    expect(result.current.selection?.path).toBe("outbound/b.md");
    vi.useRealTimers();
  });

  it("setFollowLatest 恢复自动模式", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    expect(result.current.mode).toBe("manual");
    act(() => result.current.setFollowLatest());
    expect(result.current.mode).toBe("follow-latest");
  });

  it("notifyDeleted 当前文件 → deleted", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => result.current.notifyDeleted("outbound/a.md"));
    expect(result.current.displayStatus).toBe("deleted");
  });

  it("notifyDeleted 其他文件不影响", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => result.current.notifyDeleted("outbound/b.md"));
    expect(result.current.displayStatus).not.toBe("deleted");
  });

  it("notifyReadSuccess → ready", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => result.current.notifyReadSuccess());
    expect(result.current.displayStatus).toBe("ready");
  });

  it("notifyReadFailure → read-failed", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => result.current.notifyReadFailure());
    expect(result.current.displayStatus).toBe("read-failed");
  });

  it("notifyUnsupported → unsupported", () => {
    const { result } = renderHook(() => useDockWithPreview("a1:t1"));
    act(() => result.current.open("outbound/a.md"));
    act(() => result.current.notifyUnsupported());
    expect(result.current.displayStatus).toBe("unsupported");
  });

  it("上下文切换重置状态", () => {
    const { result, rerender } = renderHook(
      ({ key }) => useDockWithPreview(key),
      { initialProps: { key: "a1:t1" } },
    );
    act(() => result.current.open("outbound/a.md"));
    expect(result.current.mode).toBe("manual");
    expect(result.current.revision).toBeGreaterThan(0);
    act(() => rerender({ key: "a1:t2" }));
    expect(result.current.mode).toBe("follow-latest");
    expect(result.current.displayStatus).toBe("idle");
    expect(result.current.hasNewArtifact).toBe(false);
  });
});
