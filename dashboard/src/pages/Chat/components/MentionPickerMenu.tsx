import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Plug, Sparkles } from "lucide-react";
import type { SkillSpec } from "../../Agent/Skills/useSkills";
import type { ChatConnectorOption } from "./ConnectorPickerPopover";
import type { ChatAgentOption } from "./ExpertAgentAvatar";
import type { ConversationReference } from "../workbenchTypes";
import ExpertAgentAvatar from "./ExpertAgentAvatar";
import styles from "../index.module.less";

export type MentionAgentOption = ChatAgentOption;

export type MentionPick =
  | { kind: "file"; path: string; label: string }
  | { kind: "skill"; slug: string; label: string }
  | { kind: "connector"; name: string; label: string }
  | { kind: "agent"; agent_id: string; label: string };

export function buildMentionItems(
  query: string,
  skills: SkillSpec[],
  connectors: ChatConnectorOption[],
  agents: MentionAgentOption[] = [],
  files: readonly ConversationReference[] = [],
): MentionPick[] {
  const q = query.trim().toLowerCase();
  const out: MentionPick[] = [];
  for (const file of files) {
    if (
      q &&
      !file.name.toLowerCase().includes(q) &&
      !file.path.toLowerCase().includes(q)
    ) {
      continue;
    }
    out.push({ kind: "file", path: file.path, label: file.name });
  }
  for (const s of skills.filter((x) => x.enabled)) {
    const label = s.name || s.slug;
    if (
      q &&
      !label.toLowerCase().includes(q) &&
      !s.slug.toLowerCase().includes(q)
    )
      continue;
    out.push({ kind: "skill", slug: s.slug, label });
  }
  for (const c of connectors) {
    if (
      q &&
      !c.label.toLowerCase().includes(q) &&
      !c.mcp_server_name.toLowerCase().includes(q)
    ) {
      continue;
    }
    out.push({ kind: "connector", name: c.mcp_server_name, label: c.label });
  }
  for (const a of agents) {
    if (
      q &&
      !a.name.toLowerCase().includes(q) &&
      !a.agent_id.toLowerCase().includes(q)
    )
      continue;
    out.push({ kind: "agent", agent_id: a.agent_id, label: a.name });
  }
  return out;
}

interface MentionPickerMenuProps {
  query: string;
  skills: SkillSpec[];
  connectors: ChatConnectorOption[];
  agents?: MentionAgentOption[];
  files?: readonly ConversationReference[];
  activeIndex: number;
  onSelect: (pick: MentionPick) => void;
  onHover: (index: number) => void;
}

export default function MentionPickerMenu({
  query,
  skills,
  connectors,
  agents = [],
  files = [],
  activeIndex,
  onSelect,
  onHover,
}: MentionPickerMenuProps) {
  const { t } = useTranslation();

  const items = useMemo(
    () => buildMentionItems(query, skills, connectors, agents, files),
    [query, skills, connectors, agents, files],
  );

  const sectionFor = (item: MentionPick) => {
    if (item.kind === "file") return t("policeWorkbench.references.files");
    if (item.kind === "skill") return t("policeWorkbench.references.skills");
    if (item.kind === "connector")
      return t("policeWorkbench.references.connectors");
    return t("policeWorkbench.references.agents");
  };

  if (items.length === 0) {
    return (
      <div className={styles.mentionMenu}>
        <div className={styles.mentionEmpty}>
          {t("mention.empty", "No matches")}
        </div>
      </div>
    );
  }

  let lastSection = "";
  let flatIndex = -1;

  return (
    <div className={styles.mentionMenu}>
      {items.map((item) => {
        const section = sectionFor(item);
        const showHeader = section !== lastSection;
        lastSection = section;
        flatIndex += 1;
        const idx = flatIndex;
        const active = idx === activeIndex;
        let icon;
        if (item.kind === "file") {
          icon = <FileText size={14} />;
        } else if (item.kind === "skill") {
          icon = <Sparkles size={14} />;
        } else if (item.kind === "connector") {
          icon = <Plug size={14} />;
        } else {
          const agent = agents.find((a) => a.agent_id === item.agent_id);
          icon = (
            <ExpertAgentAvatar
              iconName={agent?.icon_name}
              color={agent?.color}
              size={20}
              iconSize={11}
            />
          );
        }
        return (
          <div
            key={`${item.kind}-${
              item.kind === "file"
                ? item.path
                : item.kind === "skill"
                ? item.slug
                : item.kind === "connector"
                ? item.name
                : item.agent_id
            }`}
          >
            {showHeader && (
              <div className={styles.mentionCategory}>{section}</div>
            )}
            <button
              type="button"
              className={`${styles.mentionItem} ${
                active ? styles.mentionItemActive : ""
              }`}
              onMouseEnter={() => onHover(idx)}
              onClick={() => onSelect(item)}
            >
              <span className={styles.mentionIcon}>{icon}</span>
              <span className={styles.mentionLabel}>{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
