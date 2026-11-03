import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PoliceSkillRail from "./PoliceSkillRail";
import { useUserRole } from "../../../hooks/useUserRole";

vi.mock("../../../hooks/useUserRole", () => ({
  useUserRole: vi.fn(),
}));

const mockedRole = vi.mocked(useUserRole);

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.state ? `|${JSON.stringify(location.state)}` : ""}
    </div>
  );
}

function renderRail(initialPath = "/chat") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PoliceSkillRail />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("PoliceSkillRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRole.mockReturnValue("user");
  });

  it("渲染一级真实入口", () => {
    renderRail();
    expect(screen.getByTestId("police-skill-rail")).toBeInTheDocument();
    for (const key of [
      "newTask",
      "assistants",
      "projects",
      "expertsSkillsConnectors",
      "cronJobs",
      "library",
      "more",
    ]) {
      expect(
        screen.getByText(`policeWorkbench.nav.${key}`),
      ).toBeInTheDocument();
    }
  });

  it("新建任务回到当前智能体工作台", () => {
    renderRail("/chat/agent-1/thread-9");
    fireEvent.click(screen.getByText("policeWorkbench.nav.newTask"));
    expect(screen.getByTestId("location-probe").textContent).toBe(
      '/chat/agent-1|{"workbenchIntent":"new-task"}',
    );
  });

  it("项目与资料库入口在当前工作台原地导航并携带意图", () => {
    renderRail("/chat/agent-1/thread-9");
    fireEvent.click(screen.getByText("policeWorkbench.nav.projects"));
    expect(screen.getByTestId("location-probe").textContent).toBe(
      '/chat/agent-1/thread-9|{"workbenchIntent":"projects"}',
    );
    fireEvent.click(screen.getByText("policeWorkbench.nav.library"));
    expect(screen.getByTestId("location-probe").textContent).toBe(
      '/chat/agent-1/thread-9|{"workbenchIntent":"library"}',
    );
  });

  it("缺少会话上下文时不触发导航", () => {
    renderRail("/chat");
    fireEvent.click(screen.getByText("policeWorkbench.nav.newTask"));
    expect(screen.getByTestId("location-probe").textContent).toBe("/chat");
  });

  it("当前项带 aria-current，导航进入既有路由", () => {
    renderRail("/chat/agent-1");
    const assistants = screen
      .getByText("policeWorkbench.nav.assistants")
      .closest("button");
    expect(assistants).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByText("policeWorkbench.nav.cronJobs"));
    expect(screen.getByTestId("location-probe").textContent).toBe("/tasks");
  });

  it("非管理员更多菜单不含管理项", async () => {
    mockedRole.mockReturnValue("user");
    renderRail();
    fireEvent.click(screen.getByText("policeWorkbench.nav.more"));
    await waitFor(() =>
      expect(document.querySelector(".ant-dropdown")).not.toBeNull(),
    );
    expect(
      document.querySelector(".ant-dropdown")?.textContent ?? "",
    ).not.toContain("policeWorkbench.nav.settings");
  });

  it("管理员更多菜单包含设置入口并进入管理页", async () => {
    mockedRole.mockReturnValue("admin");
    renderRail();
    fireEvent.click(screen.getByText("policeWorkbench.nav.more"));
    await waitFor(() =>
      expect(
        document.querySelector(".ant-dropdown")?.textContent ?? "",
      ).toContain("policeWorkbench.nav.settings"),
    );
    const items = Array.from(
      document.querySelectorAll(".ant-dropdown-menu-item"),
    );
    const settingsItem = items.find(
      (item) => item.textContent?.includes("policeWorkbench.nav.settings"),
    );
    expect(settingsItem).toBeDefined();
    fireEvent.click(settingsItem as HTMLElement);
    expect(screen.getByTestId("location-probe").textContent).toBe(
      "/admin/advanced",
    );
  });
});
