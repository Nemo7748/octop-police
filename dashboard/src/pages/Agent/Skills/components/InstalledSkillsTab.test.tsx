import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstalledSkillsTab from "./InstalledSkillsTab";
import styles from "../index.module.less";

const { tMock } = vi.hoisted(() => ({
  tMock: vi.fn((key: string) => key),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({ t: tMock, i18n: { language: "zh" } }),
  };
});

const POLICE_SLUGS = [
  "police-ppt-generation",
  "police-document-organizing",
  "police-official-drafting",
  "police-legal-regulation-search",
  "police-case-management-webapp",
  "police-dossier-review",
];
const OFFICE_SLUGS = ["pptx", "docx", "xlsx", "pdf"];

function builtinSkill(slug: string, enabled = true) {
  return {
    slug,
    name: slug,
    description: `${slug} 描述`,
    enabled,
    kind: "builtin" as const,
  };
}

const BUILTIN_SKILLS = [...POLICE_SLUGS, ...OFFICE_SLUGS].map((slug) =>
  builtinSkill(slug),
);

function renderTab(
  props: Partial<Parameters<typeof InstalledSkillsTab>[0]> = {},
) {
  return render(
    <InstalledSkillsTab
      kind="builtin"
      skills={BUILTIN_SKILLS}
      loading={false}
      fetchSkills={vi.fn(async () => {})}
      getDetail={vi.fn(async () => null)}
      createSkill={vi.fn(async () => true)}
      importFromUrl={vi.fn(async () => true)}
      importing={false}
      toggleEnabled={vi.fn(async () => true)}
      deleteSkill={vi.fn(async () => true)}
      {...props}
    />,
  );
}

describe("InstalledSkillsTab 内置技能页签", () => {
  beforeEach(() => {
    tMock.mockClear();
  });

  it("列出警务与 Office 技能，带内置标识且无删除/导入/新建入口", () => {
    renderTab();
    for (const slug of [...POLICE_SLUGS, ...OFFICE_SLUGS]) {
      expect(screen.getByText(slug)).toBeInTheDocument();
    }
    expect(screen.getAllByText("skills.kindBuiltin")).toHaveLength(10);
    expect(
      document.querySelector(`.${styles.deleteIconBtn}`),
    ).toBeNull();
    expect(screen.queryByText("skills.importSkills")).toBeNull();
    expect(screen.queryByText("skills.createSkill")).toBeNull();
    expect(tMock).toHaveBeenCalledWith("skills.totalCount", { count: 10 });
  });

  it("点击启停按钮触发 toggleEnabled 且不触发删除", () => {
    const toggleEnabled = vi.fn(async () => true);
    const deleteSkill = vi.fn(async () => true);
    renderTab({ toggleEnabled, deleteSkill });
    fireEvent.click(screen.getAllByText("common.disable")[0]);
    expect(toggleEnabled).toHaveBeenCalledTimes(1);
    const called = toggleEnabled.mock.calls[0]?.[0] as { slug: string };
    expect([...POLICE_SLUGS, ...OFFICE_SLUGS]).toContain(called.slug);
    expect(deleteSkill).not.toHaveBeenCalled();
  });

  it("已安装页签只显示工作区技能并保留删除入口", () => {
    const mixed = [
      {
        slug: "my-skill",
        name: "my-skill",
        description: "",
        enabled: false,
        kind: "workspace" as const,
      },
      ...BUILTIN_SKILLS,
    ];
    renderTab({ kind: "custom", skills: mixed });
    expect(screen.getByText("my-skill")).toBeInTheDocument();
    expect(screen.queryByText("police-ppt-generation")).toBeNull();
    expect(
      document.querySelector(`.${styles.deleteIconBtn}`),
    ).not.toBeNull();
  });
});