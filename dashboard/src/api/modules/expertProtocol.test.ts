import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expertMarketApi } from "./expertMarket";
import { terminalAiApi } from "./terminalAi";
import { request } from "../request";
import zh from "../../locales/zh.json";
import en from "../../locales/en.json";

vi.mock("../request", () => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
  requestUpload: vi.fn(),
  getAuthToken: vi.fn(() => "token"),
}));

const mockedRequest = vi.mocked(request);

describe("专家→智能体改造的协议边界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("内置模板列表仍请求 /experts", () => {
    const pageSource = readFileSync(
      path.resolve(process.cwd(), "src/pages/Experts/index.tsx"),
      "utf-8",
    );
    expect(pageSource).toContain('request<ExpertSummary[]>("/experts")');
    expect(pageSource).toContain('request<OctopAgent[]>("/agents")');
  });

  it("专家市场路径 /experts/hub 保持不变", async () => {
    mockedRequest.mockResolvedValue({ items: [], scenes: [] });
    await expertMarketApi.list("query value", "tech");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/experts/hub?q=query+value&scene=tech",
    );

    mockedRequest.mockResolvedValue({ id: "x" });
    await expertMarketApi.get("my slug");
    expect(mockedRequest).toHaveBeenCalledWith(
      `/experts/hub/${encodeURIComponent("my slug")}`,
    );

    await expertMarketApi.install("my slug", { name: "n" });
    expect(mockedRequest).toHaveBeenCalledWith(
      `/experts/hub/${encodeURIComponent("my slug")}/install`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("终端 AI 创建路径 /agents/from-expert/ops-engineer 保持不变", async () => {
    mockedRequest.mockResolvedValue({ id: 1 });
    await terminalAiApi.createOpsEngineer();
    expect(mockedRequest).toHaveBeenCalledWith(
      "/agents/from-expert/ops-engineer",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("错误码键 EXPERT_MARKET_FAILED 保持原名且双语齐全", () => {
    const zhErrors = zh.apiErrors as Record<string, string>;
    const enErrors = en.apiErrors as Record<string, string>;
    expect(zhErrors.EXPERT_MARKET_FAILED).toBeTruthy();
    expect(enErrors.EXPERT_MARKET_FAILED).toBeTruthy();
  });
});