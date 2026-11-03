import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAgentDirectoryEntries, workspaceApi } from "./workspace";
import { request, requestBlob } from "../request";

vi.mock("../request", () => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
  requestUpload: vi.fn(),
  getAuthToken: vi.fn(() => "token"),
}));

const mockedRequest = vi.mocked(request);
const mockedRequestBlob = vi.mocked(requestBlob);

describe("workspaceApi Agent 作用域封装", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listAgentDirectory 使用显式 Agent 路径并编码参数", async () => {
    mockedRequest.mockResolvedValue([
      { name: "a.md", path: "inbound/a.md", is_dir: false },
    ]);
    const controller = new AbortController();
    const result = await workspaceApi.listAgentDirectory(
      "agent 1",
      "/inbound root",
      { signal: controller.signal },
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      `/agents/${encodeURIComponent(
        "agent 1",
      )}/workspace/tree?path=${encodeURIComponent("/inbound root")}`,
      { signal: controller.signal },
    );
    expect(result).toEqual([
      {
        name: "a.md",
        path: "inbound/a.md",
        is_dir: false,
        size: null,
        modified_time: null,
      },
    ]);
  });

  it("readAgentFile 透传取消信号", async () => {
    mockedRequest.mockResolvedValue({ path: "README.md", content: "hello" });
    const controller = new AbortController();
    await workspaceApi.readAgentFile("a1", "README.md", {
      signal: controller.signal,
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/agents/a1/workspace/file?path=README.md",
      { signal: controller.signal },
    );
  });

  it("downloadAgentFile 返回 Blob", async () => {
    const blob = new Blob(["x"]);
    mockedRequestBlob.mockResolvedValue(blob);
    await expect(workspaceApi.downloadAgentFile("a1", "a b.md")).resolves.toBe(
      blob,
    );
    expect(mockedRequestBlob).toHaveBeenCalledWith(
      `/agents/a1/workspace/download?path=${encodeURIComponent("a b.md")}`,
      { signal: undefined },
    );
  });

  it("401/403/404 与其他错误保持可区分地传播", async () => {
    const forbidden = new Error("Request failed: 403");
    mockedRequest.mockRejectedValue(forbidden);
    await expect(workspaceApi.listAgentDirectory("a1", "/")).rejects.toBe(
      forbidden,
    );
    const notFound = new Error("Request failed: 404");
    mockedRequest.mockRejectedValue(notFound);
    await expect(workspaceApi.readAgentFile("a1", "x")).rejects.toBe(notFound);
    const abort = new DOMException("aborted", "AbortError");
    mockedRequest.mockRejectedValue(abort);
    await expect(workspaceApi.readAgentFile("a1", "x")).rejects.toBe(abort);
  });

  it("normalizeAgentDirectoryEntries 保留目录与可选子节点", () => {
    const result = normalizeAgentDirectoryEntries([
      {
        name: "docs",
        path: "docs",
        is_dir: true,
        size: 10,
        modified_time: "2026-01-01",
        children: [{ name: "a", path: "docs/a", is_dir: false }],
      },
    ]);
    expect(result[0]?.children).toHaveLength(1);
    expect(result[0]?.size).toBe(10);
  });
});
