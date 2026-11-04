import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  BookOpen,
  Bot,
  Clock,
  FolderKanban,
  GraduationCap,
  MoreHorizontal,
  Plus,
  Sparkles,
} from "lucide-react";
import { useUserRole } from "../../../hooks/useUserRole";
import { usePoliceNavigation } from "../../../hooks/usePoliceNavigation";
import { prefetchRoute } from "../../../routes/prefetch";
import {
  resolvePoliceCapability,
  type PoliceCapabilityId,
} from "../../../routes/policeCapabilities";
import styles from "../workbench.module.less";

interface RailEntry {
  readonly key: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly current: boolean;
  readonly onClick?: () => void;
  readonly menu?: MenuProps;
}

const MENU_CAPABILITY_IDS: Record<string, PoliceCapabilityId> = {
  experts: "experts",
  skills: "skills",
  connectors: "connectors",
  channels: "channels",
  subagents: "subagents",
  memory: "memory",
  models: "models",
  settings: "settings",
};

export default function PoliceSkillRail() {
  const { t } = useTranslation();
  const navigation = usePoliceNavigation();
  const location = useLocation();
  const role = useUserRole();
  const pathname = location.pathname;
  const selectedKey = resolvePoliceCapability(pathname)?.selectedKey ?? null;

  const entries = useMemo<readonly RailEntry[]>(() => {
    const openMenuCapability = (sourceEntry: string, key: string) => {
      const capabilityId = MENU_CAPABILITY_IDS[key];
      if (!capabilityId) return;
      navigation.navigate({ sourceEntry, capabilityId });
    };
    const moreItems: NonNullable<MenuProps["items"]> = [
      { key: "connectors", label: t("nav.connectors", "连接器") },
      { key: "channels", label: t("nav.channels", "渠道") },
      { key: "subagents", label: t("nav.subagents", "子智能体") },
      { key: "memory", label: t("nav.memory", "记忆") },
    ];
    if (role === "admin") {
      moreItems.push(
        { key: "models", label: t("nav.models", "模型") },
        { key: "settings", label: t("policeWorkbench.nav.settings") },
      );
    }
    const moreMenu: MenuProps = {
      items: moreItems,
      onClick: ({ key }) => openMenuCapability("skill-rail.more", key),
    };
    return [
      {
        key: "new-task",
        label: t("policeWorkbench.nav.newTask"),
        icon: <Plus size={20} strokeWidth={1.8} />,
        current: false,
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.new-task",
            capabilityId: "new-task",
          }),
      },
      {
        key: "assistants",
        label: t("policeWorkbench.nav.assistants"),
        icon: <Bot size={20} strokeWidth={1.8} />,
        current: selectedKey === "chat",
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.assistants",
            capabilityId: "assistants",
          }),
      },
      {
        key: "projects",
        label: t("policeWorkbench.nav.projects"),
        icon: <FolderKanban size={20} strokeWidth={1.8} />,
        current: false,
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.projects",
            capabilityId: "projects",
          }),
      },
      {
        key: "experts",
        label: t("policeWorkbench.nav.experts"),
        icon: <GraduationCap size={20} strokeWidth={1.8} />,
        current: selectedKey === "experts",
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.experts",
            capabilityId: "experts",
          }),
      },
      {
        key: "skills",
        label: t("policeWorkbench.nav.skills"),
        icon: <Sparkles size={20} strokeWidth={1.8} />,
        current: selectedKey === "skills",
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.skills",
            capabilityId: "skills",
          }),
      },
      {
        key: "cron",
        label: t("policeWorkbench.nav.cronJobs"),
        icon: <Clock size={20} strokeWidth={1.8} />,
        current: selectedKey === "tasks",
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.cron",
            capabilityId: "cron",
          }),
      },
      {
        key: "library",
        label: t("policeWorkbench.nav.library"),
        icon: <BookOpen size={20} strokeWidth={1.8} />,
        current: false,
        onClick: () =>
          navigation.navigate({
            sourceEntry: "skill-rail.library",
            capabilityId: "library",
          }),
      },
      {
        key: "more",
        label: t("policeWorkbench.nav.more"),
        icon: <MoreHorizontal size={20} strokeWidth={1.8} />,
        current:
          selectedKey === "connectors" ||
          selectedKey === "channels" ||
          selectedKey === "subagents" ||
          selectedKey === "memory" ||
          selectedKey === "models" ||
          selectedKey === "admin-advanced",
        menu: moreMenu,
      },
    ];
  }, [t, navigation, selectedKey, role]);

  return (
    <nav
      className={styles.skillRail}
      aria-label={t("policeWorkbench.brand.name")}
      data-testid="police-skill-rail"
    >
      {entries.map((entry) => {
        const button = (
          <button
            key={entry.key}
            type="button"
            className={styles.railItem}
            data-current={entry.current}
            aria-current={entry.current ? "page" : undefined}
            title={entry.label}
            onMouseEnter={
              entry.key === "new-task" ? () => prefetchRoute("/chat") : undefined
            }
            onFocus={
              entry.key === "new-task" ? () => prefetchRoute("/chat") : undefined
            }
            onClick={entry.menu ? undefined : entry.onClick}
          >
            <span className={styles.railIcon} aria-hidden>
              {entry.icon}
            </span>
            <span className={styles.railLabel}>{entry.label}</span>
          </button>
        );
        return entry.menu ? (
          <Dropdown
            key={entry.key}
            menu={entry.menu}
            trigger={["click"]}
            placement="bottomLeft"
          >
            {button}
          </Dropdown>
        ) : (
          button
        );
      })}
    </nav>
  );
}
