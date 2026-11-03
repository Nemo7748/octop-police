import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarkdownErrorBoundary from "./MarkdownErrorBoundary";

function Broken(): never {
  throw new Error("render boom");
}

describe("MarkdownErrorBoundary", () => {
  it("单篇渲染失败回退源码与刷新，不导致整页崩溃", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MarkdownErrorBoundary sourceText="# 原始源码">
        <Broken />
      </MarkdownErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("policeWorkbench.preview.renderFailed"),
    ).toBeInTheDocument();
    expect(screen.getByText("# 原始源码")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("正常内容直接渲染", () => {
    render(
      <MarkdownErrorBoundary>
        <div>正常文档</div>
      </MarkdownErrorBoundary>,
    );
    expect(screen.getByText("正常文档")).toBeInTheDocument();
  });
});
