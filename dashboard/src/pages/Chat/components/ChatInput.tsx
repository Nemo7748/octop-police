import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import { message as antMessage } from "antd";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useSlashCommands } from "../../../hooks/useSlashCommands";
import SlashCommandMenu from "./SlashCommandMenu";
import { agentChatApi } from "../../../api/modules/agentChat";
import type { ChatAttachment } from "../hooks/useChat";
import type { ResolvedModel } from "../../../api/types";
import type { SkillSpec } from "../../Agent/Skills/useSkills";
import type { ChatAgentOption } from "./ExpertAgentAvatar";
import MentionPickerMenu from "./MentionPickerMenu";
import ChatInputPreviewBar from "./ChatInputPreviewBar";
import ChatInputActionsRow from "./ChatInputActionsRow";
import { useVoiceInput } from "../../../hooks/useVoiceInput";
import { useKeyboardOffset } from "../../../hooks/useKeyboardOffset";
import { useChatAttachments } from "../hooks/useChatAttachments";
import { useSlashMentionInput } from "../hooks/useSlashMentionInput";
import { stripThinkingTags } from "../utils/chatAttachments";
import { readInputDraft, writeInputDraft } from "../hooks/chatStore";
import {
  clearSubmittedSnapshot,
  getSnapshot as getComposerDraft,
  setPendingGuidance,
  subscribe as subscribeComposerDraft,
} from "../hooks/composerDraftStore";
import {
  subscribe as subscribeChatSession,
  getSnapshot as getChatSessionSnapshot,
} from "../hooks/chatStore";

const EMPTY_GUIDANCE: readonly string[] = Object.freeze([]);
import { makeContextKey } from "../utils/workbenchContext";
import { useConversationReferences } from "../hooks/useConversationReferences";
import { referenceToAttachment } from "../utils/conversationReferences";
import {
  computePlanFingerprint,
  useExecutionMode,
} from "../hooks/useExecutionMode";
import type { ComposerResourceSnapshot, SendReceipt } from "../workbenchTypes";
import RoleSelector from "./RoleSelector";
import ExecutionModeSelector from "./ExecutionModeSelector";
import PlanConfirmationCard from "./PlanConfirmationCard";
import wbStyles from "../workbench.module.less";
import styles from "../index.module.less";

/** Imperative handle exposed via ref for programmatic text injection. */
export interface ChatInputHandle {
  setPrefillText: (text: string) => void;
}

interface ChatInputProps {
  onSend: (
    text: string,
    attachments?: ChatAttachment[],
  ) => Promise<SendReceipt> | SendReceipt | void;
  onCancel: () => void;
  onNewChat: () => void;
  onUserInput?: () => void;
  browserRecording?: boolean;
  browserReplayBusy?: boolean;
  browserLastRecordingId?: string | null;
  onStartBrowserRecording?: () => void;
  onStopBrowserRecording?: () => void;
  onReplayBrowserRecording?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  /** Pre-fill the input with this text on mount (e.g. navigated from another page). */
  initialText?: string;
  availableModels?: ResolvedModel[];
  selectedModel?: string | null;
  onModelChange?: (model: string | null) => void;
  availableConnectors?: {
    mcp_server_name: string;
    label: string;
    kind: string;
  }[];
  selectedConnectors?: string[];
  onConnectorsChange?: (names: string[]) => void;
  availableSkills?: SkillSpec[];
  selectedSkills?: string[];
  onSkillsChange?: (names: string[]) => void;
  availableAgents?: ChatAgentOption[];
  selectedTargetAgents?: string[];
  onTargetAgentsChange?: (ids: string[]) => void;
  agentId?: string | null;
  threadId?: string | null;
  defaultModel?: string | null;
  contextUsedTokens?: number | null;
  contextMaxTokens?: number;
  roleAgentId?: string | null;
  onRoleChange?: (agentId: string) => void;
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      onSend,
      onCancel,
      onNewChat,
      onUserInput,
      browserRecording,
      browserReplayBusy,
      browserLastRecordingId,
      onStartBrowserRecording,
      onStopBrowserRecording,
      onReplayBrowserRecording,
      isStreaming,
      disabled,
      initialText = "",
      availableModels,
      selectedModel,
      onModelChange,
      availableConnectors,
      selectedConnectors = [],
      onConnectorsChange,
      availableSkills,
      selectedSkills = [],
      onSkillsChange,
      availableAgents = [],
      selectedTargetAgents = [],
      onTargetAgentsChange,
      agentId,
      threadId,
      defaultModel,
      contextUsedTokens = null,
      contextMaxTokens = 128_000,
      roleAgentId = null,
      onRoleChange,
    },
    ref,
  ) {
    const { t, i18n } = useTranslation();
    const { commands: slashCommands, labelFor } = useSlashCommands("ui");
    const isMobile = useIsMobile();
    useKeyboardOffset();
    const [text, setText] = useState(
      () => initialText || readInputDraft(agentId, threadId),
    );
    const [polishing, setPolishing] = useState(false);
    // Track whether the user has manually edited the text after a prefill.
    // Once they start editing, we must not overwrite their input with a new
    // initialText value (e.g. from a parent re-render or a stale effect).
    const userHasEditedRef = useRef(false);

    const handleVoiceText = useCallback(
      (spoken: string) => {
        setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
        userHasEditedRef.current = true;
        onUserInput?.();
      },
      [onUserInput],
    );
    const {
      recording,
      transcribing,
      toggle: toggleVoice,
    } = useVoiceInput(handleVoiceText);

    // Expose an imperative handle so the parent can push a new prefill without
    // triggering a prop change that would cause a re-render cascade.
    useImperativeHandle(ref, () => ({
      setPrefillText: (newText: string) => {
        userHasEditedRef.current = false;
        prevInitialTextRef.current = newText;
        setText(newText);
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 50);
      },
    }));
    // When the parent passes a non-empty initialText after mount (e.g. navigated
    // from cron-jobs), update the input value and move the cursor to the end.
    // Only fires when initialText actually changes AND the user hasn't started
    // editing yet (prevents overwriting mid-edit content).
    const prevInitialTextRef = useRef(initialText);
    const prevComposerKeyRef = useRef(`${agentId ?? ""}:${threadId ?? ""}`);
    useEffect(() => {
      if (
        initialText &&
        initialText !== prevInitialTextRef.current &&
        !userHasEditedRef.current
      ) {
        prevInitialTextRef.current = initialText;
        setText(initialText);
        // Focus the textarea so the user can immediately start editing
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 50);
      }
    }, [initialText]);

    // Restore per-thread draft when switching conversations or remounting.
    useEffect(() => {
      const composerKey = `${agentId ?? ""}:${threadId ?? ""}`;
      if (composerKey === prevComposerKeyRef.current) return;
      prevComposerKeyRef.current = composerKey;
      userHasEditedRef.current = false;
      prevInitialTextRef.current = "";
      setText(initialText || readInputDraft(agentId, threadId));
    }, [agentId, threadId, initialText]);

    // Persist draft while typing so leaving /chat and returning keeps content.
    useEffect(() => {
      if (!agentId) return;
      const timer = window.setTimeout(() => {
        writeInputDraft(agentId, threadId, text);
      }, 250);
      return () => window.clearTimeout(timer);
    }, [text, agentId, threadId]);
    const {
      attachments,
      uploading,
      dragOver,
      fileInputRef,
      acceptAttr,
      handleFileSelect,
      handleFileChange,
      removeAttachment,

      handlePaste,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
    } = useChatAttachments(agentId, threadId);
    const {
      references,
      files: referenceFiles,
      invalidPaths: invalidReferencePaths,
      addReference,
      removeReference,
      validateReferences,
    } = useConversationReferences(agentId, threadId);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const submitRef = useRef<() => void>(() => {});
    const workbenchContextKey = agentId
      ? makeContextKey({ agentId, threadId: threadId ?? null })
      : "";
    const execution = useExecutionMode(workbenchContextKey);
    const pendingGuidance = useSyncExternalStore(
      useCallback(
        (listener: () => void) =>
          workbenchContextKey
            ? subscribeComposerDraft(workbenchContextKey, listener)
            : () => undefined,
        [workbenchContextKey],
      ),
      useCallback(
        () =>
          workbenchContextKey
            ? getComposerDraft(workbenchContextKey).pendingGuidance
            : EMPTY_GUIDANCE,
        [workbenchContextKey],
      ),
    );
    const runStatus = useSyncExternalStore(
      useCallback(
        (listener: () => void) =>
          threadId ? subscribeChatSession(threadId, listener) : () => undefined,
        [threadId],
      ),
      useCallback(
        () =>
          threadId
            ? getChatSessionSnapshot(threadId).runStatus
            : ("unknown" as const),
        [threadId],
      ),
    );
    const currentResources = useMemo<ComposerResourceSnapshot>(
      () => ({
        roleAgentId: roleAgentId ?? agentId ?? null,
        model: selectedModel ?? defaultModel ?? null,
        skills: selectedSkills,
        connectors: selectedConnectors,
        references,
        attachmentCount: attachments.length,
      }),
      [
        roleAgentId,
        agentId,
        selectedModel,
        defaultModel,
        selectedSkills,
        selectedConnectors,
        references,
        attachments.length,
      ],
    );

    const MIN_TEXTAREA_HEIGHT = isMobile ? 42 : 78;

    const {
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
    } = useSlashMentionInput({
      text,
      setText,
      textareaRef,
      slashCommands,
      labelFor,
      locale: i18n.language,
      availableSkills,
      availableConnectors,
      availableAgents,
      availableFiles: referenceFiles,
      onReferenceSelect: addReference,
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
      onSubmitRef: submitRef,
      enterToSend: !isMobile,
    });

    const submitMessage = useCallback(
      async (forceExecute = false) => {
        const trimmed = text.trim();
        if (
          (!trimmed && attachments.length === 0 && references.length === 0) ||
          disabled
        ) {
          return;
        }
        const slashItem = matchSlashCommand(trimmed);
        if (slashItem && slashItem.spec.client_action !== "none") {
          runSlashCommand(slashItem);
          return;
        }
        if (execution.mode === "plan" && !forceExecute) {
          execution.beginPlan(trimmed, currentResources);
          return;
        }
        if (isStreaming && !forceExecute) {
          if (trimmed && workbenchContextKey) {
            setPendingGuidance(workbenchContextKey, [
              ...getComposerDraft(workbenchContextKey).pendingGuidance,
              trimmed,
            ]);
            setText("");
            writeInputDraft(agentId, threadId, "");
          }
          return;
        }
        const ta = textareaRef.current;
        const prevHeight = ta ? ta.getBoundingClientRect().height : 0;
        const snapshotAttachments =
          attachments.length > 0 ? [...attachments] : [];
        let validReferences = references;
        if (references.length > 0 && agentId) {
          try {
            const validation = await validateReferences();
            if (validation.invalid.length > 0) {
              antMessage.error(t("policeWorkbench.references.invalid"));
              return;
            }
            validReferences = validation.valid;
          } catch {
            antMessage.error(t("policeWorkbench.references.invalid"));
            return;
          }
        }
        const referenceAttachments = agentId
          ? validReferences.map((reference) =>
              referenceToAttachment(agentId, reference),
            )
          : [];
        const allAttachments = [
          ...snapshotAttachments,
          ...referenceAttachments,
        ];
        const receipt = await onSend(
          trimmed,
          allAttachments.length > 0 ? allAttachments : undefined,
        );
        if (receipt && receipt.status !== "accepted") {
          return;
        }
        if (agentId) {
          clearSubmittedSnapshot(
            makeContextKey({ agentId, threadId: threadId ?? null }),
            { references: validReferences, attachments: snapshotAttachments },
          );
        }
        setText("");
        writeInputDraft(agentId, threadId, "");
        userHasEditedRef.current = false;
        prevInitialTextRef.current = "";
        requestAnimationFrame(() => {
          if (ta && prevHeight > MIN_TEXTAREA_HEIGHT) {
            ta.style.transition = "none";
            ta.style.height = `${prevHeight}px`;
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            ta.offsetHeight;
            ta.style.transition = "";
            ta.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
          }
        });
      },
      [
        text,
        attachments,
        references,
        onSend,
        disabled,
        matchSlashCommand,
        runSlashCommand,

        MIN_TEXTAREA_HEIGHT,
        agentId,
        threadId,
        validateReferences,
        t,
        execution,
        currentResources,
        isStreaming,
        workbenchContextKey,
      ],
    );

    submitRef.current = submitMessage;

    // Pixel Avatar: listen for user input.
    useEffect(() => {
      if (onUserInput && text.length > 0) {
        onUserInput();
      }
    }, [text, onUserInput]);

    const adjustHeight = useCallback(
      (animate = false) => {
        const ta = textareaRef.current;
        if (!ta) return;
        // Disable transition during measurement to avoid visual glitches
        ta.style.transition = "none";
        ta.style.height = "auto";
        const target = Math.max(
          Math.min(ta.scrollHeight, 160),
          MIN_TEXTAREA_HEIGHT,
        );
        if (animate) {
          // Snap to current rendered height first (no transition), then animate to target
          const current = ta.getBoundingClientRect().height;
          ta.style.height = `${current}px`;
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          ta.offsetHeight; // force reflow
          ta.style.transition = "";
          ta.style.height = `${target}px`;
        } else {
          ta.style.height = `${target}px`;
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          ta.offsetHeight;
          ta.style.transition = "";
        }
      },
      [MIN_TEXTAREA_HEIGHT],
    );

    useEffect(() => {
      adjustHeight();
    }, [text, adjustHeight]);

    const handlePolish = useCallback(async () => {
      const draft = text.trim();
      if (!draft || !agentId || polishing || isStreaming || disabled) return;
      setPolishing(true);
      try {
        const result = await agentChatApi.polish(agentId, draft, selectedModel);
        const polished = stripThinkingTags(result.text?.trim() ?? "");
        if (!polished) {
          antMessage.error(t("chat.polish.emptyResult"));
          return;
        }
        userHasEditedRef.current = true;
        setText(polished);
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 50);
      } catch (err: unknown) {
        antMessage.error(
          err instanceof Error ? err.message : t("chat.polish.failed"),
        );
      } finally {
        setPolishing(false);
      }
    }, [text, agentId, polishing, isStreaming, disabled, selectedModel, t]);

    const canSend = Boolean(
      (text.trim() || attachments.length > 0) && !disabled,
    );

    return (
      <div
        className={`${styles.chatInput} ${dragOver ? styles.dropActive : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={styles.inputWrapper}>
          <ChatInputPreviewBar
            attachments={attachments}
            uploading={uploading}
            references={references}
            invalidReferencePaths={invalidReferencePaths}
            onRemoveReference={removeReference}
            selectedSkills={selectedSkills}
            selectedConnectors={selectedConnectors}
            selectedTargetAgents={selectedTargetAgents}
            selectedModel={selectedModel}
            availableSkills={availableSkills}
            availableConnectors={availableConnectors}
            availableAgents={availableAgents}
            onRemoveAttachment={removeAttachment}
            onSkillsChange={onSkillsChange}
            onConnectorsChange={onConnectorsChange}
            onTargetAgentsChange={onTargetAgentsChange}
            onModelChange={onModelChange}
          />

          {execution.pendingPlan && (
            <PlanConfirmationCard
              goalText={execution.pendingPlan.goalText}
              resources={execution.pendingPlan.resources}
              stale={
                computePlanFingerprint(text.trim(), currentResources) !==
                execution.pendingPlan.fingerprint
              }
              onConfirm={() => {
                execution.confirmPlan(text.trim(), currentResources, () => {
                  void submitMessage(true);
                });
              }}
              onCancel={execution.cancelPlan}
            />
          )}
          {execution.planCancelled && !execution.pendingPlan && (
            <p className={wbStyles.planNotice} role="status">
              {t("policeWorkbench.plan.cancelled")}
            </p>
          )}

          {pendingGuidance.length > 0 && (
            <div
              className={wbStyles.guidanceQueue}
              data-testid="guidance-queue"
            >
              <p className={wbStyles.planNotice} role="status">
                {t("policeWorkbench.execution.queued")}
              </p>
              <ul className={wbStyles.guidanceList}>
                {pendingGuidance.map((guidance, index) => (
                  <li key={`${index}-${guidance}`}>
                    <span className={wbStyles.guidanceText}>{guidance}</span>
                    <button
                      type="button"
                      className={wbStyles.fileLink}
                      onClick={() =>
                        setPendingGuidance(
                          workbenchContextKey,
                          pendingGuidance.filter((_, i) => i !== index),
                        )
                      }
                    >
                      {t("policeWorkbench.execution.revokeGuidance")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onRoleChange && (
            <div className={wbStyles.metaRow}>
              {(isStreaming ||
                runStatus === "failed" ||
                runStatus === "cancelled") && (
                <span
                  className={wbStyles.runStatusText}
                  data-status={isStreaming ? "running" : runStatus}
                  role="status"
                >
                  {isStreaming
                    ? t("policeWorkbench.runStatus.running")
                    : t(`policeWorkbench.runStatus.${runStatus}`)}
                </span>
              )}
              <RoleSelector
                agents={availableAgents}
                value={roleAgentId ?? agentId ?? null}
                onChange={onRoleChange}
                disabled={disabled}
              />
              <ExecutionModeSelector
                value={execution.mode}
                onChange={execution.setMode}
                disabled={disabled}
              />
            </div>
          )}

          <div className={styles.inputRow} style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={text}
              onChange={(e) => {
                userHasEditedRef.current = true;
                handleTextChange(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t("policeWorkbench.composer.placeholder")}
              rows={1}
              disabled={disabled}
              enterKeyHint={isMobile ? "enter" : undefined}
            />
            {/*
            Slash badge (plan §14.5): octop's HarnessProcessor handles slash
            commands server-side. The composer doesn't intercept them — it
            just surfaces a small inline pill so the user sees they're
            issuing a command, not a regular message.
          */}
            {text.startsWith("/") && (
              <span
                data-testid="slash-badge"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  background: "var(--fn-color-brand-bg, rgba(79,110,247,0.12))",
                  color: "var(--fn-color-brand, #4f6ef7)",
                  border: "1px solid var(--fn-color-brand, #4f6ef7)",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: "16px",
                  pointerEvents: "none",
                  userSelect: "none",
                  letterSpacing: 0.2,
                }}
              >
                /<span style={{ fontWeight: 500 }}>slash</span>
              </span>
            )}
          </div>

          {mentionMenuOpen && mentionItems.length > 0 && (
            <MentionPickerMenu
              query={mentionQuery}
              skills={availableSkills ?? []}
              connectors={availableConnectors ?? []}
              agents={mentionAgents}
              files={referenceFiles}
              activeIndex={mentionMenuIndex}
              onSelect={handleMentionSelect}
              onHover={setMentionMenuIndex}
            />
          )}

          {/* Slash command inline menu */}
          {slashMenuOpen && slashCombinedFlat.length > 0 && (
            <div className={styles.slashMenu}>
              {slashSkillItems.length > 0 && (
                <div>
                  <div className={styles.mentionCategory}>
                    {t("policeWorkbench.references.skills")}
                  </div>
                  {slashSkillItems.map((entry, index) => (
                    <button
                      key={entry.slug}
                      type="button"
                      className={`${styles.mentionItem} ${
                        slashMenuIndex === index ? styles.mentionItemActive : ""
                      }`}
                      onMouseEnter={() => setSlashMenuIndex(index)}
                      onClick={() => handleCombinedSelect(entry)}
                    >
                      <span className={styles.mentionLabel}>{entry.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <SlashCommandMenu
                groups={slashMenuGroups}
                flatItems={slashMenuFlat}
                activeIndex={slashMenuIndex - slashSkillItems.length}
                disabled={isStreaming || disabled}
                variant="inline"
                itemsGridClassName={styles.slashMenuGrid}
                itemClassName={styles.slashMenuItem}
                activeClassName={styles.slashMenuItemActive}
                categoryClassName={styles.slashMenuCategory}
                labelClassName={styles.slashMenuLabel}
                cmdClassName={styles.slashMenuCmd}
                onSelect={handleSlashSelect}
                onHover={setSlashMenuIndex}
                footer={
                  <div className={styles.slashMenuHint}>
                    {t(
                      "slash.menuHint",
                      "↑↓ navigate · Enter confirm · Esc close",
                    )}
                  </div>
                }
              />
            </div>
          )}

          <ChatInputActionsRow
            isMobile={isMobile}
            isStreaming={isStreaming}
            disabled={disabled}
            canSend={canSend}
            text={text}
            polishing={polishing}
            uploading={uploading}
            recording={recording}
            transcribing={transcribing}
            browserRecording={browserRecording}
            browserReplayBusy={browserReplayBusy}
            browserLastRecordingId={browserLastRecordingId}
            onStartBrowserRecording={onStartBrowserRecording}
            onStopBrowserRecording={onStopBrowserRecording}
            onReplayBrowserRecording={onReplayBrowserRecording}
            agentId={agentId}
            threadId={threadId}
            contextUsedTokens={contextUsedTokens}
            contextMaxTokens={contextMaxTokens}
            availableModels={availableModels}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            defaultModel={defaultModel}
            availableConnectors={availableConnectors}
            selectedConnectors={selectedConnectors}
            onConnectorsChange={onConnectorsChange}
            availableSkills={availableSkills}
            selectedSkills={selectedSkills}
            onSkillsChange={onSkillsChange}
            availableExperts={availableAgents.filter(
              (a) => a.agent_id !== agentId,
            )}
            selectedTargetAgents={selectedTargetAgents}
            onTargetAgentsChange={onTargetAgentsChange}
            slashPickerGroups={slashPickerGroups}
            slashMenuItems={slashMenuItems}
            onSlashShortcutSelect={handleSlashSelect}
            onFileSelect={handleFileSelect}
            onNewChat={onNewChat}
            onPolish={() => void handlePolish()}
            onToggleVoice={() => toggleVoice()}
            onCancel={onCancel}
            onSubmit={() => void submitMessage()}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
        {!isMobile && (
          <p className={styles.aiDisclaimer}>{t("chatWelcome.aiDisclaimer")}</p>
        )}
      </div>
    );
  },
);

export default ChatInput;
