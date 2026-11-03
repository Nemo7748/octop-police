import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSkills } from "./useSkills";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("../../../api/request", () => ({
  request: requestMock,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "zh" },
    }),
  };
});

describe("useSkills", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("home_entry 附加字段被忽略且 builtin kind 正确映射", async () => {
    requestMock.mockResolvedValue([
      {
        slug: "police-ppt-generation",
        name: "警务PPT生成",
        description: "生成警务演示文稿",
        enabled: true,
        kind: "builtin",
        emoji: "📊",
        home_entry: {
          order: 1,
          prompt: { zh: "生成 PPT", en: "Generate PPT" },
          color: "#c2410c",
          icon_name: "presentation",
        },
      },
      {
        slug: "pptx",
        name: "pptx",
        description: "office",
        enabled: true,
        kind: "builtin",
      },
      {
        slug: "docx",
        name: "docx",
        description: "office",
        enabled: true,
        kind: "builtin",
      },
      {
        slug: "xlsx",
        name: "xlsx",
        description: "office",
        enabled: true,
        kind: "builtin",
      },
      {
        slug: "pdf",
        name: "pdf",
        description: "office",
        enabled: true,
        kind: "builtin",
      },
      {
        slug: "my-custom",
        name: "my-custom",
        description: "",
        enabled: true,
        kind: "workspace",
      },
    ]);
    const { result } = renderHook(() => useSkills("a1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.skills).toHaveLength(6);
    const police = result.current.skills.find(
      (s) => s.slug === "police-ppt-generation",
    );
    expect(police).toMatchObject({ kind: "builtin", enabled: true });
    expect(police).not.toHaveProperty("home_entry");
  });

  it("toggleEnabled 调用 disable 接口并本地翻转状态", async () => {
    requestMock.mockImplementation((url: unknown) => {
      const path = typeof url === "string" ? url : String(url);
      if (path === "/agents/a1/skills") {
        return Promise.resolve([
          {
            slug: "police-ppt-generation",
            name: "警务PPT生成",
            description: "",
            enabled: true,
            kind: "builtin",
          },
        ]);
      }
      return Promise.resolve({});
    });
    const { result } = renderHook(() => useSkills("a1"));
    await waitFor(() => expect(result.current.skills).toHaveLength(1));
    const ok = await result.current.toggleEnabled(result.current.skills[0]);
    expect(ok).toBe(true);
    expect(requestMock).toHaveBeenCalledWith(
      "/agents/a1/skills/police-ppt-generation/disable",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() =>
      expect(result.current.skills[0].enabled).toBe(false),
    );
  });
});