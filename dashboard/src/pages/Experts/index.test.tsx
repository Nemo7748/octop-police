import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpertsPage from "./index";
import styles from "./index.module.less";
import { useAgent } from "../../context/AgentContext";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
const { tMock } = vi.hoisted(() => ({
  tMock: vi.fn((key: string) => key),
}));

vi.mock("../../api/request", () => ({
  request: requestMock,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({ t: tMock, i18n: { language: "zh" } }),
  };
});

vi.mock("../../context/AgentContext", () => ({
  useAgent: vi.fn(),
}));

vi.mock("../../layouts/PageShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockedUseAgent = vi.mocked(useAgent);

function template(id: string, group: string, order: number) {
  return {
    id,
    label: { zh: id, en: id },
    description: { zh: `${id} 描述`, en: `${id} desc` },
    welcome_message: { zh: `欢迎使用 ${id}`, en: `Welcome to ${id}` },
    icon_name: "shield",
    color: "#1f6feb",
    group,
    order,
    quick_prompts: [
      {
        title: { zh: "示例", en: "Demo" },
        description: { zh: "示例提示", en: "Demo prompt" },
        prompt: { zh: "生成示例", en: "Generate demo" },
        color: "#e8f4ff",
        icon_name: null,
      },
    ],
  };
}

const LIBRARY_ROWS = [
  template("w5", "web-workbench", 5),
  template("p2", "police-development", 2),
  template("w1", "web-workbench", 1),
  template("p5", "police-development", 5),
  template("w6", "web-workbench", 6),
  template("p1", "police-development", 1),
  template("w3", "web-workbench", 3),
  template("p4", "police-development", 4),
  template("w2", "web-workbench", 2),
  template("p3", "police-development", 3),
  template("w4", "web-workbench", 4),
];

const EXPECTED_ORDER = [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "w1",
  "w2",
  "w3",
  "w4",
  "w5",
  "w6",
];

describe("ExpertsPage 内置智能体页签", () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockImplementation((url: unknown) => {
      const path = typeof url === "string" ? url : String(url);
      if (path === "/experts") return Promise.resolve(LIBRARY_ROWS);
      if (path.startsWith("/experts/"))
        return Promise.resolve({ file_contents: [] });
      return Promise.resolve([]);
    });
    mockedUseAgent.mockReturnValue({
      agents: [],
      refresh: async () => {},
    } as unknown as ReturnType<typeof useAgent>);
  });

  it("页签文案齐备，内置页与首页同源恰 11 项且按组序展示", async () => {
    render(<ExpertsPage />);
    expect(screen.getByText("experts.myExperts")).toBeInTheDocument();
    expect(screen.getByText("experts.expertLibrary")).toBeInTheDocument();
    expect(screen.getByText("experts.expertMarket")).toBeInTheDocument();

    fireEvent.click(screen.getByText("experts.expertLibrary"));
    await screen.findByText("p1");

    const names = Array.from(
      document.querySelectorAll(`.${styles.agentCardName}`),
    ).map((el) => el.textContent);
    expect(names).toEqual(EXPECTED_ORDER);
    expect(tMock).toHaveBeenCalledWith("experts.totalLibrary", { count: 11 });
  });

  it("旧后端目录（无分组元数据）显示版本不支持提示", async () => {
    requestMock.mockImplementation((url: unknown) => {
      const path = typeof url === "string" ? url : String(url);
      if (path === "/experts")
        return Promise.resolve([
          {
            id: "general-assistant",
            label: { zh: "通用助手", en: "General" },
            description: { zh: "旧模板", en: "legacy" },
          },
        ]);
      return Promise.resolve([]);
    });
    render(<ExpertsPage />);
    fireEvent.click(screen.getByText("experts.expertLibrary"));
    await screen.findByText("policeWorkbench.home.catalogUnsupported");
    expect(
      document.querySelector(`.${styles.expertTemplateCard}`),
    ).toBeNull();
  });

  it("点击模板卡打开创建智能体抽屉", async () => {
    render(<ExpertsPage />);
    fireEvent.click(screen.getByText("experts.expertLibrary"));
    await screen.findByText("p1");
    fireEvent.click(screen.getByText("p1"));
    await waitFor(() => {
      expect(document.querySelector(".ant-drawer-open")).not.toBeNull();
    });
  });
});