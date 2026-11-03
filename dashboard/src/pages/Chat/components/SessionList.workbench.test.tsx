import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SessionList from "./SessionList";
import type { Session } from "../hooks/useSessions";
import type { OctopAgent } from "../../../context/AgentContext";

const agents = [
  {
    agent_id: "a1",
    name: "警务助理",
    state: "running",
    description: "",
    icon_name: "bot",
    color: "#000000",
  },
  {
    agent_id: "a2",
    name: "内勤助理",
    state: "running",
    description: "",
    icon_name: "bot",
    color: "#000000",
  },
] as unknown as OctopAgent[];

const sessions: Session[] = [
  {
    id: "t1",
    name: "案情分析",
    threadId: "t1",
    updatedAt: null,
    channelType: "dashboard",
  },
];

function renderList(
  overrides: Partial<Parameters<typeof SessionList>[0]> = {},
) {
  const props: Parameters<typeof SessionList>[0] = {
    agents,
    sessions,
    activeId: null,
    activeAgentId: "a1",
    hasMore: false,
    loadingMore: false,
    onLoadMore: vi.fn(),
    onFetchAllSessions: vi.fn(),
    onSelect: vi.fn(),
    onAgentSelect: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onPin: vi.fn(),
    ...overrides,
  };
  return {
    props,
    ...render(
      <MemoryRouter>
        <SessionList {...props} />
      </MemoryRouter>,
    ),
  };
}

describe("SessionList 警务目录", () => {
  it("显示真实空间与任务计数", () => {
    renderList();
    expect(screen.getByTestId("space-count").textContent).toContain(
      "policeWorkbench.catalog.spaces",
    );
    expect(screen.getByTestId("task-count").textContent).toContain(
      "policeWorkbench.catalog.tasks",
    );
  });

  it("分页未完整时显示已加载范围而非总数", () => {
    renderList({ hasMore: true });
    expect(screen.getByTestId("task-count").textContent).toContain(
      "policeWorkbench.catalog.loadedScope",
    );
  });

  it("搜索无结果时显示空态且不展示统计", () => {
    renderList();
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "不存在的任务" } });
    expect(screen.getByText("没有匹配的会话")).toBeInTheDocument();
    expect(screen.queryByTestId("task-count")).toBeNull();
  });

  it("选择任务走既有回调并保留新建/删除能力", () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    fireEvent.click(screen.getByText("案情分析"));
    expect(onSelect).toHaveBeenCalledWith("t1", "a1");
  });
});
