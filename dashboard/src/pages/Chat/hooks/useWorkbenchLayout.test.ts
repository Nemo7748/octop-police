import { describe, expect, it } from "vitest";
import { deriveLayout, resolveBreakpoint } from "./useWorkbenchLayout";

describe("useWorkbenchLayout 断点", () => {
  it(">=1280 为 wide", () => {
    expect(resolveBreakpoint(1280)).toBe("wide");
    expect(resolveBreakpoint(1440)).toBe("wide");
  });

  it("768–1279 为 medium", () => {
    expect(resolveBreakpoint(768)).toBe("medium");
    expect(resolveBreakpoint(1279)).toBe("medium");
    expect(resolveBreakpoint(1024)).toBe("medium");
  });

  it("<768 为 narrow", () => {
    expect(resolveBreakpoint(767)).toBe("narrow");
    expect(resolveBreakpoint(390)).toBe("narrow");
  });

  it("wide 四区固定，其余为覆盖抽屉", () => {
    expect(deriveLayout("wide").directoryOverlay).toBe(false);
    expect(deriveLayout("wide").previewOverlay).toBe(false);
    expect(deriveLayout("medium").directoryOverlay).toBe(true);
    expect(deriveLayout("medium").previewOverlay).toBe(true);
    expect(deriveLayout("narrow").isNarrow).toBe(true);
  });
});
