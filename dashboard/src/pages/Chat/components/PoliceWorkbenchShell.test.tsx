import { useEffect, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PoliceWorkbenchShell from "./PoliceWorkbenchShell";

let mountCount = 0;

function MountProbe() {
  const [, force] = useState(0);
  useEffect(() => {
    mountCount += 1;
  }, []);
  return (
    <div data-testid="mount-probe" data-mounts={mountCount}>
      <button onClick={() => force((n) => n + 1)}>rerender</button>
    </div>
  );
}

describe("PoliceWorkbenchShell", () => {
  it("按技能区、目录区、中央区、预览区顺序排列并包含状态栏", () => {
    const { container } = render(
      <PoliceWorkbenchShell
        skillRail={<nav>rail</nav>}
        directory={<aside>directory</aside>}
        preview={<aside>preview</aside>}
        statusBar={<footer>status</footer>}
      >
        <div>center</div>
      </PoliceWorkbenchShell>,
    );
    const shell = screen.getByTestId("police-workbench-shell");
    const regions = Array.from(shell.querySelectorAll("[data-region]")).map(
      (el) => el.getAttribute("data-region"),
    );
    expect(regions).toEqual(["skill", "directory", "center", "preview"]);
    expect(container.querySelector("footer")?.textContent).toBe("status");
    expect(screen.getByText("center")).toBeInTheDocument();
  });

  it("面板属性变化不会重挂载中央会话", () => {
    mountCount = 0;
    const { rerender } = render(
      <PoliceWorkbenchShell
        skillRail={<nav>rail</nav>}
        directory={<aside>d</aside>}
        preview={<aside>p1</aside>}
        statusBar={<footer>s</footer>}
      >
        <MountProbe />
      </PoliceWorkbenchShell>,
    );

    fireEvent.click(screen.getByText("rerender"));
    expect(screen.getByTestId("mount-probe").getAttribute("data-mounts")).toBe(
      "1",
    );
    rerender(
      <PoliceWorkbenchShell
        skillRail={<nav>rail</nav>}
        directory={<aside>d2</aside>}
        preview={<aside>p2</aside>}
        statusBar={<footer>s</footer>}
      >
        <MountProbe />
      </PoliceWorkbenchShell>,
    );
    fireEvent.click(screen.getByText("rerender"));
    expect(screen.getByTestId("mount-probe").getAttribute("data-mounts")).toBe(
      "1",
    );
  });

  it("首次数据未返回时中央骨架立即可渲染", () => {
    render(
      <PoliceWorkbenchShell
        skillRail={null}
        directory={null}
        preview={null}
        statusBar={null}
      >
        <div data-testid="skeleton">skeleton</div>
      </PoliceWorkbenchShell>,
    );
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});

describe("PoliceWorkbenchShell 无额外全局副作用", () => {
  it("不注册全局事件监听", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { unmount } = render(
      <PoliceWorkbenchShell
        skillRail={null}
        directory={null}
        preview={null}
        statusBar={null}
      >
        <div />
      </PoliceWorkbenchShell>,
    );
    unmount();
    expect(addSpy).not.toHaveBeenCalled();
    addSpy.mockRestore();
  });
});
