import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilePreview from "./FilePreview";

describe("FilePreview HTML 沙箱", () => {
  it("iframe sandbox 不含 allow-same-origin", () => {
    const { container } = render(
      <FilePreview kind="html" content="<p>hello</p>" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("视口切换按钮存在且默认桌面宽度", () => {
    const { container } = render(
      <FilePreview kind="html" content="<p>hi</p>" />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    const iframe = container.querySelector("iframe");
    expect(iframe?.style.width).toBe("100%");
  });

  it("点击移动视口切换 iframe 宽度", () => {
    const { container } = render(
      <FilePreview kind="html" content="<p>hi</p>" />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]);
    const iframe = container.querySelector("iframe");
    expect(iframe?.style.width).toBe("390px");
  });

  it("markdown kind 不渲染 iframe", () => {
    const { container } = render(
      <FilePreview kind="markdown" content="# title" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
  });
});