import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EnvironmentBadge from "./EnvironmentBadge";
import WorkbenchStatusBar from "./WorkbenchStatusBar";
import { probeHealth } from "../../../api/probeHealth";

vi.mock("../../../api/probeHealth", () => ({
  probeHealth: vi.fn(),
}));

const mockedProbe = vi.mocked(probeHealth);

describe("EnvironmentBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("回环地址显示本机，健康成功显示已连接", async () => {
    mockedProbe.mockResolvedValue({ ok: true });
    render(<EnvironmentBadge />);
    await waitFor(() =>
      expect(
        screen.getByText("policeWorkbench.environment.connected"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText("policeWorkbench.environment.local"),
    ).toBeInTheDocument();
  });

  it("健康失败显示连接失败并可点击重试", async () => {
    mockedProbe.mockResolvedValue({ ok: false });
    render(<EnvironmentBadge />);
    const badge = await screen.findByRole("button", {
      name: /policeWorkbench\.environment\.disconnected/,
    });
    expect(badge).toHaveAttribute("data-retryable", "true");
    mockedProbe.mockResolvedValue({ ok: true });
    fireEvent.click(badge);
    await waitFor(() =>
      expect(
        screen.getByText("policeWorkbench.environment.connected"),
      ).toBeInTheDocument(),
    );
    expect(mockedProbe).toHaveBeenCalledTimes(2);
  });
});

describe("WorkbenchStatusBar", () => {
  it("显示版权信息且为布局行", async () => {
    mockedProbe.mockResolvedValue({ ok: true });
    render(<WorkbenchStatusBar />);
    expect(screen.getByTestId("workbench-status-bar").tagName).toBe("FOOTER");
    expect(
      screen.getByText("policeWorkbench.footer.copyright"),
    ).toBeInTheDocument();
  });
});
