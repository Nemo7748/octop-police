import { useCallback, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SlashCommandSpec } from "../../../api/modules/slash";
import { resolveSlashIcon } from "../../../utils/slashIcons";
import { groupSlashByCategory } from "../../../utils/slashCategories";
import type { SkillSpec } from "../../Agent/Skills/useSkills";
import type { ChatAgentOption } from "../components/ExpertAgentAvatar";
import type { ConversationReference } from "../workbenchTypes";
import {
  buildMentionItems,
  type MentionPick,
} from "../components/MentionPickerMenu";
import { getMentionAtCursor } from "../utils/mentionAtCursor";
import {
  slashCommandNeedsInput,
  slashCommandPrefillText,
} from "../../../utils/quickInputPrefill";

export type SlashMenuItem = {
  command: string;
  label: string;
  icon: ReturnType<typeof resolveSlashIcon>;
  tone: string;
  spec: SlashCommandSpec;
};

export type SlashSkillEntry = {
  kind: "skill";
  slug: string;
  label: string;
};

export type SlashCommandEntry = {
  kind: "command";
  item: SlashMenuItem;
};

export type SlashCombinedEntry = SlashSkillEntry | SlashCommandEntry;

interface UseSlashMentionInputParams {
  text: string;
  setText: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  slashCommands: SlashCommandSpec[];
  labelFor: (spec: SlashCommandSpec) => string;
  locale: string;
  availableSkills?: SkillSpec[];
  availableConnectors?: {
    mcp_server_name: string;
    label: string;
    kind: string;
  }[];
  availableAgents: ChatAgentOption[];
  availableFiles?: readonly ConversationReference[];
  onReferenceSelect?: (reference: ConversationReference) => void;
  agentId?: string | null;
  selectedSkills: string[];
  selectedConnectors: string[];
  selectedTargetAgents: string[];
  onSkillsChange?: (names: string[]) => void;
  onConnectorsChange?: (names: string[]) => void;
  onTargetAgentsChange?: (ids: string[]) => void;
  onSend: (text: string) => void;
  onNewChat: () => void;
  onCancel: () => void;
  isStreaming: boolean;
  onSubmitRef: React.MutableRefObject<() => void>;
  /** When false, Enter inserts a newline; send only via button (mobile). */
  enterToSend?: boolean;
}

export function useSlashMentionInput({
  text,
  setText,
  textareaRef,
  slashCommands,
  labelFor,
  locale,
  availableSkills,
  availableConnectors,
  availableAgents,
  availableFiles,
  onReferenceSelect,
  agentId,
  selectedSkills,
  selectedConnectors,
  selectedTargetAgents,
  onSkillsChange,
  onConnectorsChange,
  onTargetAgentsChange,
  onSend,
  onNewChat,
  onCancel,
  isStreaming,
  onSubmitRef,
  enterToSend = true,
}: UseSlashMentionInputParams) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionMenuIndex, setMentionMenuIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAtIndex, setMentionAtIndex] = useState(-1);

  const mentionAgents = useMemo(
    () => availableAgents.filter((a) => a.agent_id !== agentId),
    [availableAgents, agentId],
  );

  const mentionItems = useMemo(
    () =>
      buildMentionItems(
        mentionQuery,
        availableSkills ?? [],
        availableConnectors ?? [],
        mentionAgents,
        availableFiles ?? [],
      ),
    [
      mentionQuery,
      availableSkills,
      availableConnectors,
      mentionAgents,
      availableFiles,
    ],
  );

  const slashMenuItems = useMemo<SlashMenuItem[]>(
    () =>
      slashCommands.map((spec) => ({
        command: spec.usage || `/${spec.name}`,
        label: labelFor(spec),
        icon: resolveSlashIcon(spec.icon),
        tone: spec.tone,
        spec,
      })),
    [slashCommands, labelFor],
  );

  const filteredSlashCommands = useMemo(() => {
    if (!slashMenuOpen) return slashMenuItems;
    const query = text.slice(1).toLowerCase();
    if (!query) return slashMenuItems;
    return slashMenuItems.filter(
      (c) =>
        c.command.toLowerCase().includes(query) ||
        c.label.toLowerCase().includes(query) ||
        c.spec.name.includes(query),
    );
  }, [text, slashMenuOpen, slashMenuItems]);

  const slashMenuQuery = text.startsWith("/")
    ? text.slice(1).toLowerCase()
    : "";
  const slashMenuGrouped = slashMenuOpen && !slashMenuQuery;

  const slashMenuGroups = useMemo(
    () =>
      slashMenuGrouped
        ? groupSlashByCategory(filteredSlashCommands, locale)
        : null,
    [slashMenuGrouped, filteredSlashCommands, locale],
  );

  const slashMenuFlat = useMemo(
    () =>
      slashMenuGroups
        ? slashMenuGroups.flatMap((group) => group.items)
        : filteredSlashCommands,
    [slashMenuGroups, filteredSlashCommands],
  );

  const slashPickerGroups = useMemo(
    () => groupSlashByCategory(slashMenuItems, locale),
    [slashMenuItems, locale],
  );

  const slashSkillItems = useMemo<readonly SlashSkillEntry[]>(() => {
    if (!slashMenuOpen) return [];
    const query = text.startsWith("/") ? text.slice(1).toLowerCase() : "";
    return (availableSkills ?? [])
      .filter((skill) => skill.enabled)
      .filter((skill) => {
        if (!query) return true;
        const label = skill.name || skill.slug;
        return (
          label.toLowerCase().includes(query) ||
          skill.slug.toLowerCase().includes(query)
        );
      })
      .map((skill) => ({
        kind: "skill" as const,
        slug: skill.slug,
        label: skill.name || skill.slug,
      }));
  }, [slashMenuOpen, text, availableSkills]);

  const slashCombinedFlat = useMemo<readonly SlashCombinedEntry[]>(
    () => [
      ...slashSkillItems,
      ...slashMenuFlat.map((item) => ({ kind: "command" as const, item })),
    ],
    [slashSkillItems, slashMenuFlat],
  );

  const handleSlashSkillSelect = useCallback(
    (slug: string) => {
      setSlashMenuOpen(false);
      setText("");
      if (!onSkillsChange) return;
      onSkillsChange(
        selectedSkills.includes(slug)
          ? selectedSkills.filter((name) => name !== slug)
          : [...selectedSkills, slug],
      );
      textareaRef.current?.focus();
    },
    [onSkillsChange, selectedSkills, setText, textareaRef],
  );

  const focusTextareaEnd = useCallback(() => {
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  }, [textareaRef]);

  const runSlashCommand = useCallback(
    (item: SlashMenuItem) => {
      setSlashMenuOpen(false);
      if (item.spec.client_action === "new_chat") {
        onNewChat();
        setText("");
      } else if (item.spec.client_action === "cancel_stream") {
        onCancel();
        setText("");
      } else if (slashCommandNeedsInput(item.spec)) {
        setText(slashCommandPrefillText(item.spec));
        focusTextareaEnd();
      } else {
        onSend(item.command);
        setText("");
      }
    },
    [onSend, onNewChat, onCancel, setText, focusTextareaEnd],
  );

  const matchSlashCommand = useCallback(
    (trimmed: string): SlashMenuItem | undefined =>
      slashMenuItems.find(
        (c) =>
          c.command === trimmed ||
          `/${c.spec.name}` === trimmed ||
          c.spec.aliases.some((a) => `/${a}` === trimmed),
      ),
    [slashMenuItems],
  );

  const handleMentionSelect = useCallback(
    (pick: MentionPick) => {
      const before = text.slice(0, mentionAtIndex);
      const after = text.slice(mentionAtIndex + mentionQuery.length + 1);
      setText(`${before}${after}`.trimStart());
      setMentionMenuOpen(false);
      if (pick.kind === "file") {
        onReferenceSelect?.({
          path: pick.path,
          name: pick.label,
          kind: "file",
        });
      } else if (pick.kind === "skill" && onSkillsChange) {
        onSkillsChange(
          selectedSkills.includes(pick.slug)
            ? selectedSkills.filter((n) => n !== pick.slug)
            : [...selectedSkills, pick.slug],
        );
      } else if (pick.kind === "connector" && onConnectorsChange) {
        onConnectorsChange(
          selectedConnectors.includes(pick.name)
            ? selectedConnectors.filter((n) => n !== pick.name)
            : [...selectedConnectors, pick.name],
        );
      } else if (pick.kind === "agent" && onTargetAgentsChange) {
        onTargetAgentsChange(
          selectedTargetAgents.includes(pick.agent_id)
            ? selectedTargetAgents.filter((id) => id !== pick.agent_id)
            : [...selectedTargetAgents, pick.agent_id],
        );
      }
      textareaRef.current?.focus();
    },
    [
      text,
      mentionAtIndex,
      mentionQuery,
      setText,
      onSkillsChange,
      selectedSkills,
      onConnectorsChange,
      selectedConnectors,
      onTargetAgentsChange,
      selectedTargetAgents,
      onReferenceSelect,
      textareaRef,
    ],
  );

  const handleSlashSelect = useCallback(
    (command: string) => {
      const item = slashMenuItems.find((c) => c.command === command);
      if (item) runSlashCommand(item);
    },
    [slashMenuItems, runSlashCommand],
  );

  const handleCombinedSelect = useCallback(
    (entry: SlashCombinedEntry) => {
      if (entry.kind === "skill") {
        handleSlashSkillSelect(entry.slug);
      } else {
        handleSlashSelect(entry.item.command);
      }
    },
    [handleSlashSkillSelect, handleSlashSelect],
  );

  const handleTextChange = useCallback(
    (val: string) => {
      setText(val);
      if (val.startsWith("/") && !val.includes(" ") && !val.includes("\n")) {
        setSlashMenuOpen(true);
        setSlashMenuIndex(0);
        setMentionMenuOpen(false);
      } else {
        setSlashMenuOpen(false);
        const mention = getMentionAtCursor(val);
        if (
          mention &&
          (availableSkills ||
            availableConnectors ||
            mentionAgents.length > 0 ||
            (availableFiles?.length ?? 0) > 0)
        ) {
          setMentionMenuOpen(true);
          setMentionQuery(mention.query);
          setMentionAtIndex(mention.atIndex);
          setMentionMenuIndex(0);
        } else {
          setMentionMenuOpen(false);
        }
      }
    },
    [
      setText,
      availableSkills,
      availableConnectors,
      mentionAgents.length,
      availableFiles?.length,
    ],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;

      if (mentionMenuOpen && mentionItems.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionMenuIndex((i) => (i + 1) % mentionItems.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionMenuIndex(
            (i) => (i - 1 + mentionItems.length) % mentionItems.length,
          );
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          const selected = mentionItems[mentionMenuIndex];
          if (selected) handleMentionSelect(selected);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionMenuOpen(false);
          return;
        }
      }

      if (slashMenuOpen && slashCombinedFlat.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashMenuIndex((i) => (i + 1) % slashCombinedFlat.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashMenuIndex(
            (i) =>
              (i - 1 + slashCombinedFlat.length) % slashCombinedFlat.length,
          );
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          const selected = slashCombinedFlat[slashMenuIndex];
          if (selected) handleCombinedSelect(selected);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashMenuOpen(false);
          return;
        }
      }

      if (enterToSend && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) return;
        onSubmitRef.current();
      }
    },
    [
      enterToSend,
      isStreaming,
      onSubmitRef,
      mentionMenuOpen,
      mentionItems,
      mentionMenuIndex,
      handleMentionSelect,
      slashMenuOpen,
      slashCombinedFlat,
      slashMenuIndex,
      handleCombinedSelect,
    ],
  );

  const closeShortcutPicker = useCallback(() => {
    setSlashMenuOpen(false);
  }, []);

  return {
    slashMenuOpen,
    slashMenuIndex,
    setSlashMenuIndex,
    mentionMenuOpen,
    mentionMenuIndex,
    setMentionMenuIndex,
    mentionQuery,
    mentionAgents,
    slashMenuFlat,
    slashMenuGroups,
    slashPickerGroups,
    slashMenuItems,
    slashSkillItems,
    slashCombinedFlat,
    mentionItems,
    runSlashCommand,
    matchSlashCommand,
    handleMentionSelect,
    handleSlashSelect,
    handleCombinedSelect,
    handleTextChange,
    handleKeyDown,
    closeShortcutPicker,
  };
}
