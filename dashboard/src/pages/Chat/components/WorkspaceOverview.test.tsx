import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceOverview from "./WorkspaceOverview";
import { workspaceApi } from "../../../api/modules/workspace";

vi.mock("../../../api/modules/workspace", () => ({
  workspaceApi: {
    listAgentDirectory: vi.fn(),
    readAgentFile: vi.fn(),
    downloadAgentFile: vi.fn(),
  },
}));

const mockedApi = vi.mocked(workspaceApi);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderOverview(
  overrides: Partial<Parameters<typeof WorkspaceOverview>[0]> = {},
) {
  const props: Parameters<typeof WorkspaceOverview>[0] = {
    agentId: "a1",
    context: { agentId: "a1", threadId: null },
    businessTag: null,
    onBusinessTagChange: vi.fn(),
    onOpenFile: vi.fn(),

    ...overrides,
  };
  return {
    props,
    ...render(
      <MemoryRouter>
        <WorkspaceOverview {...props} />
        <LocationProbe />
      </MemoryRouter>,
    ),
  };
}

describe("WorkspaceOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listAgentDirectory.mockResolvedValue([
      { name: "README.md", path: "README.md", is_dir: false },
      { name: "inbound", path: "inbound", is_dir: true },
    ]);
    mockedApi.readAgentFile.mockResolvedValue({
      path: "README.md",
      content: "## 本次已交付\n- 完成首页\n",
    });
  });

  it("不再渲染双入口卡，任务摘要与文件区保留", async () => {
    const onOpenFile = vi.fn();
    renderOverview({ onOpenFile });
    expect(
      screen.queryByText("policeWorkbench.overview.policeMakerTitle"),
    ).toBeNull();
    expect(
      screen.queryByText("policeWorkbench.overview.webWorkbenchTitle"),
    ).toBeNull();
    expect(screen.getByTestId("location-probe").textContent).toBe("/");
    expect(await screen.findByText("完成首页")).toBeInTheDocument();
    const readmeButtons = await screen.findAllByRole("button", {
      name: "README.md",
    });
    fireEvent.click(readmeButtons[0]!);
    expect(onOpenFile).toHaveBeenCalledWith("README.md");
  });

  it("业务标签切换仍触发回调", () => {
    const onBusinessTagChange = vi.fn();
    renderOverview({ onBusinessTagChange });
    fireEvent.click(screen.getByText("policeWorkbench.tags.office"));
    expect(onBusinessTagChange).toHaveBeenCalledWith("office");
  });

  it("文件来自真实索引，点击统一打开预览", async () => {
    const onOpenFile = vi.fn();
    renderOverview({ onOpenFile });
    await waitFor(() =>
      expect(mockedApi.listAgentDirectory).toHaveBeenCalled(),
    );
    const readmeButtons = await screen.findAllByRole("button", {
      name: "README.md",
    });
    fireEvent.click(readmeButtons[0]!);
    expect(onOpenFile).toHaveBeenCalledWith("README.md");
  });

  it("摘要来自 README 同名小节", async () => {
    renderOverview();
    expect(await screen.findByText("完成首页")).toBeInTheDocument();
    expect(screen.getByText("policeWorkbench.brief.title")).toBeInTheDocument();
  });

  it("索引失败显示加载失败与重试，不冒充空数据", async () => {
    mockedApi.listAgentDirectory.mockRejectedValue(new Error("500"));
    renderOverview();
    expect(
      await screen.findByText("policeWorkbench.catalog.loadFailed"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("policeWorkbench.catalog.retry"));
    await waitFor(() =>
      expect(mockedApi.listAgentDirectory.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it("切换上下文时清理旧展开状态与摘要", async () => {
    const { rerender, props } = renderOverview();
    await screen.findByText("完成首页");
    mockedApi.readAgentFile.mockResolvedValue({
      path: "README.md",
      content: "无同名小节的正文",
    });
    rerender(
      <MemoryRouter>
        <WorkspaceOverview
          {...props}
          context={{ agentId: "a1", threadId: "t2" }}
        />
        <LocationProbe />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText("完成首页")).not.toBeInTheDocument(),
    );
  });
});
