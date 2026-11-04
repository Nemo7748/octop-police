import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PanelLeftOpen, GraduationCap } from "lucide-react";
import { Button, Modal, Space, Tooltip } from "antd";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";
import * as chatStore from "./hooks/chatStore";
import { formatRunUsage } from "./utils/chatMessages";
import { useChatSidebarState } from "./hooks/useChatSidebarState";
import { useChatDockPanel } from "./hooks/useChatDockPanel";
import { useWorkbenchPreview } from "./hooks/useWorkbenchPreview";
import { useTaskArtifacts } from "./hooks/useTaskArtifacts";
import { useChatSend } from "./hooks/useChatSend";
import { useChatNavigation } from "./hooks/useChatNavigation";
import { useChatSessionActions } from "./hooks/useChatSessionActions";

import { useChatComposerResources } from "./hooks/useChatComposerResources";
import { useChatContextWindow } from "./hooks/useChatContextWindow";
import { useBrowserToolDetection } from "./hooks/useBrowserToolDetection";
import { useChatFileDetection } from "./hooks/useChatFileDetection";
import { useSkillRecordingWorkflow } from "./hooks/useSkillRecordingWorkflow";
import { browserApi } from "../../api/modules/browser";
import type { TokenUsage } from "../../api/types";
import type { ChatAttachment } from "./hooks/useChat";
import MessageList from "./components/MessageList";
import ChatInput, { type ChatInputHandle } from "./components/ChatInput";
import WelcomeScreen from "./components/WelcomeScreen";
import AgentNotReadyScreen from "./components/AgentNotReadyScreen";
import AgentProfileDrawer from "../../components/AgentProfileDrawer";
import { useExpertChatWelcome } from "./hooks/useExpertQuickCards";
import { useSkills } from "../Agent/Skills/useSkills";
import { useAgent } from "../../context/AgentContext";
import { useBrowserSessionState } from "../../hooks/useBrowserSessionState";
import { prefetchVoiceConfig } from "../../hooks/useVoiceConfig";
import ChatDockPanels from "./components/ChatDockPanels";
import { ChatFilePreviewProvider } from "./ChatFilePreviewContext";
import ChatSidebarPanel from "./components/ChatSidebarPanel";
import ChatComposerChrome from "./components/ChatComposerChrome";
import PoliceWorkbenchShell from "./components/PoliceWorkbenchShell";
import TaskResultPanel from "./components/TaskResultPanel";
import PoliceSkillRail from "./components/PoliceSkillRail";
import WorkbenchStatusBar from "./components/WorkbenchStatusBar";
import WorkspaceOverview from "./components/WorkspaceOverview";
import PoliceHomeLauncher from "./components/PoliceHomeLauncher";
import CreateFromExpertDrawer from "../Experts/components/CreateFromExpertDrawer";
import {
  usePoliceHomeCatalog,
  type AgentInstanceSummary,
  type PoliceHomeSourceKey,
  type RecommendedSkill,
} from "./hooks/usePoliceHomeCatalog";
import { usePoliceAgentLaunch } from "./hooks/usePoliceAgentLaunch";
import { launchRecommendedSkill } from "./utils/policeSkillLaunch";
import { useWorkbenchUi } from "./hooks/useWorkbenchUi";
import { useWorkbenchLayout } from "./hooks/useWorkbenchLayout";
import {
  getSnapshot as getComposerDraft,
  setPendingGuidance,
} from "./hooks/composerDraftStore";
import { makeContextKey } from "./utils/workbenchContext";
import { projectTaskArtifacts } from "./utils/taskArtifacts";
import type {
  ResourceState,
  SendReceipt,
  TaskArtifactItem,
} from "./workbenchTypes";
import {
  formatAgentState,
  isAgentChatReady,
} from "../../utils/agentError";
import { normalizeUiLocale } from "../../utils/localePrefs";
import { beginNavigationIntent } from "../../utils/navigationIntent";
import { promptNeedsUserInput } from "../../utils/quickInputPrefill";
import {
  buildNewTaskPath,
  isExplicitNewTask,
  type WorkbenchNavigationState,
} from "../../routes/policeCapabilities";
import styles from "./index.module.less";

const EMPTY_AGENTS_BY_TEMPLATE: ReadonlyMap<
  string,
  readonly AgentInstanceSummary[]
> = new Map();

export default function ChatPage() {
  return <ChatPageInner />;
}

function ChatPageInner() {
  const { t, i18n } = useTranslation();
  const lang = normalizeUiLocale(i18n.language);
  const navigate = useNavigate();
  const location = useLocation();
  prefetchVoiceConfig();
  const { agentId: routeAgentId, threadId } = useParams<{
    agentId?: string;
    threadId?: string;
  }>();
  const isMobile = useIsMobile();
  const [selectedTargetAgents, setSelectedTargetAgents] = useState<string[]>(
    [],
  );
  const [browserRecording, setBrowserRecording] = useState(false);
  const [browserRecordingId, setBrowserRecordingId] = useState<string | null>(
    null,
  );
  const [, setBrowserLastRecordingId] = useState<string | null>(null);
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    isSidebarResizing,
    sidebarElRef,
    handleSidebarResizeStart,
  } = useChatSidebarState(isMobile);

  // Pre-fill text from router state or module-level pending prefill
  // (set by cron-jobs suggestions before navigating here).
  // Stored as a ref (not state) so it never triggers a parent re-render —
  // re-renders would cause ChatInput to receive a new initialText prop and
  // potentially overwrite text the user is already editing.
  const prefillInputRef = useRef(
    chatStore.consumePendingPrefillText() ||
      ((location.state as { prefillInput?: string } | null)?.prefillInput ??
        ""),
  );
  // Imperative handle to push a new prefill into the already-mounted ChatInput.
  const chatInputRef = useRef<ChatInputHandle | null>(null);

  // Clear the router state after consuming prefillInput so it doesn't persist
  // on subsequent visits or page refreshes.
  useEffect(() => {
    if (prefillInputRef.current) {
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: {},
      });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When location.state arrives with a new prefillInput (component already mounted,
  // user navigated here again from another page), push it imperatively so we
  // never trigger a parent re-render that could disrupt the user's editing.
  useEffect(() => {
    const pending = chatStore.consumePendingPrefillText();
    const val =
      pending ||
      ((location.state as { prefillInput?: string } | null)?.prefillInput ??
        "");
    if (val && val !== prefillInputRef.current) {
      prefillInputRef.current = val;
      chatInputRef.current?.setPrefillText(val);
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: {},
      });
    }
  }, [location.state, location.pathname, location.search, navigate]);

  const activeThreadId = threadId || null;
  const explicitNewTask = isExplicitNewTask(location.search);

  const {
    activeAgentId,
    agents,
    setActiveAgent,
    refresh: refreshAgents,
    loading: agentsLoading,
  } = useAgent();
  const resolvedAgentId = routeAgentId || activeAgentId;
  const activeAgent = useMemo(
    () => agents.find((a) => a.agent_id === resolvedAgentId) ?? null,
    [agents, resolvedAgentId],
  );
  const agentChatReady = isAgentChatReady(activeAgent?.state);
  const noAgents = !agentsLoading && agents.length === 0;

  useEffect(() => {
    void refreshAgents({ silent: true });
  }, [refreshAgents]);

  const { welcomeSuffix } = useExpertChatWelcome(activeAgent);
  const { skills: chatSkills } = useSkills(
    agentChatReady && !agentsLoading ? resolvedAgentId ?? null : null,
  );
  const [agentProfileOpen, setAgentProfileOpen] = useState(false);

  const {
    sessions,
    loading: sessionsLoading,
    hasMore: sessionsHasMore,
    loadingMore: sessionsLoadingMore,
    error: sessionsError,
    createSession,
    deleteSession,
    renameSession,
    pinSession,
    fetchSessions,
    loadMoreSessions,
    fetchAllSessions,
    ensureThreadInList,
  } = useSessions(resolvedAgentId ?? null);

  const handleLoadMoreSessions = useCallback(() => {
    void loadMoreSessions(activeThreadId ?? undefined);
  }, [loadMoreSessions, activeThreadId]);

  const handleFetchAllSessions = useCallback(() => {
    void fetchAllSessions(activeThreadId ?? undefined);
  }, [fetchAllSessions, activeThreadId]);

  const handleRetrySessions = useCallback(() => {
    void fetchSessions(activeThreadId ?? undefined);
  }, [fetchSessions, activeThreadId]);

  useEffect(() => {
    if (routeAgentId && routeAgentId !== activeAgentId) {
      setActiveAgent(routeAgentId);
    }
  }, [routeAgentId, activeAgentId, setActiveAgent]);

  const {
    messages,
    isStreaming,
    thinkingStartedAt,
    historyLoading,
    historyHasMore,
    historyLoadingMore,
    historyRefreshing,
    contextUsage,
    sendMessage,
    editAndResend,
    cancelStream,
    loadHistory,
    loadMoreHistory,
    refreshHistory,
    clearMessages,
    resumeHitl,
  } = useChat(activeThreadId, resolvedAgentId);

  const refreshBrowserRef = useRef<() => void>(() => {});

  const { hasBrowserTool, setHasBrowserTool } = useBrowserToolDetection(
    activeThreadId,
    messages,
    () => refreshBrowserRef.current(),
  );

  const {
    sessionId: browserSessionId,
    state: browserSessionState,
    controlOwner: browserControlOwner,
    environment: browserEnvironment,
    refresh: refreshBrowserSession,
  } = useBrowserSessionState(threadId, hasBrowserTool);

  refreshBrowserRef.current = refreshBrowserSession;

  const { filePaths } = useChatFileDetection(activeThreadId, messages);
  const {
    dockOpen,
    dockKind,
    dockMode,
    filePath: filePanelPath,
    panelSizes: dockPanelSizes,
    isResizing: dockIsResizing,
    handleResizeStart: dockHandleResizeStart,
    handleClose: handleDockClose,
    clearPreviewSelection,
    handleModeChange: handleDockModeChange,
    openFilePanel,
    openFileAt,
    openBrowserPanel,
    toggleBrowserPanel,
    resetDismissOnSessionGone,
  } = useChatDockPanel(isMobile);

  const panelFilePaths = useMemo(() => {
    if (!filePanelPath) return filePaths;
    const normalized = filePanelPath;
    if (filePaths.some((p) => p === normalized)) return filePaths;
    return [...filePaths, normalized];
  }, [filePaths, filePanelPath]);

  const prevBrowserStateRef = useRef<string>("idle");
  useEffect(() => {
    if (isMobile) return;
    prevBrowserStateRef.current = browserSessionState;
    resetDismissOnSessionGone(browserSessionId);
  }, [
    browserSessionId,
    browserSessionState,
    isMobile,
    resetDismissOnSessionGone,
  ]);

  const {
    selectedModel,
    setSelectedModel,
    selectedConnectors,
    selectedSkills,
    chatConnectors,
    availableModels,
    handleConnectorsChange,
    handleSkillsChange,
  } = useChatComposerResources(
    resolvedAgentId,
    chatSkills,
    activeAgent?.default_model,
  );

  const { contextMaxTokens, contextUsedTokens } = useChatContextWindow(
    messages,
    contextUsage,
    selectedModel,
    availableModels,
    activeAgent?.default_model,
  );

  const sessionUsage = useMemo(() => {
    const acc: TokenUsage = {};
    for (const msg of messages) {
      const u = msg.usage;
      if (!u) continue;
      if (typeof u.input_tokens === "number") {
        acc.input_tokens = (acc.input_tokens || 0) + u.input_tokens;
      }
      if (typeof u.output_tokens === "number") {
        acc.output_tokens = (acc.output_tokens || 0) + u.output_tokens;
      }
      if (typeof u.total_tokens === "number") {
        acc.total_tokens = (acc.total_tokens || 0) + u.total_tokens;
      }
    }
    if (!acc.input_tokens && !acc.output_tokens && !acc.total_tokens) {
      return null;
    }
    return acc;
  }, [messages]);
  const sessionUsageLabel = formatRunUsage(sessionUsage, {
    input: t("chatUsage.input"),
    output: t("chatUsage.output"),
    total: t("chatUsage.total"),
  });

  const { resetNavForAgentSwitch, markInitialNavDone } = useChatNavigation({
    routeAgentId,
    threadId,
    resolvedAgentId,
    activeThreadId,
    explicitNewTask,
    sessions,
    sessionsLoading,
    prefillInputRef,
    loadHistory,
    clearMessages,
    ensureThreadInList,
    fetchSessions,
    refreshAgents,
  });

  const chatAgentOptions = useMemo(
    () =>
      agents.map((a) => ({
        agent_id: a.agent_id,
        name: a.name,
        icon_name: a.icon_name,
        color: a.color,
      })),
    [agents],
  );

  const composerLookups = useMemo(
    () => ({
      skills: chatSkills,
      connectors: chatConnectors,
      agents: chatAgentOptions,
    }),
    [chatSkills, chatConnectors, chatAgentOptions],
  );

  const { handleSend } = useChatSend({
    resolvedAgentId,
    activeThreadId,
    sessions,
    messagesLength: messages.length,
    selectedModel,
    selectedConnectors,
    selectedSkills,
    selectedTargetAgents,
    defaultModel: activeAgent?.default_model ?? null,
    sendMessage,
    createSession,
    renameSession,
    onAutoRecordingStarted: useCallback((recordingId: string) => {
      setBrowserRecording(true);
      setBrowserRecordingId(recordingId);
      setBrowserLastRecordingId(recordingId);
    }, []),
    t,
  });

  // --- Skill recording workflow ---
  const { interceptUserMessage } = useSkillRecordingWorkflow({
    agentId: resolvedAgentId,
    threadId: activeThreadId,
    browserRecording,
    browserRecordingId,
    setBrowserRecording,
    setBrowserRecordingId,
    setBrowserLastRecordingId,
  });

  // Wrap handleSend to intercept skill recording workflow keywords
  const wrappedHandleSend = useCallback(
    async (
      text: string,
      attachments?: ChatAttachment[],
    ): Promise<SendReceipt> => {
      if (interceptUserMessage(text)) {
        // The workflow intercepted the message — don't send it to the agent
        return { status: "accepted" };
      }
      return handleSend(text, attachments);
    },
    [interceptUserMessage, handleSend],
  );

  // 执行中补充指导：当前流结束/取消后按顺序作为同一任务的新 turn 恰好提交一次。
  const prevStreamingRef = useRef(false);
  const guidanceContextKey = resolvedAgentId
    ? makeContextKey({ agentId: resolvedAgentId, threadId: activeThreadId })
    : "";
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;
    if (!wasStreaming || isStreaming || !guidanceContextKey) return;
    const queue = getComposerDraft(guidanceContextKey).pendingGuidance;
    const next = queue[0];
    if (!next) return;
    setPendingGuidance(guidanceContextKey, queue.slice(1));
    void wrappedHandleSend(next);
  }, [isStreaming, guidanceContextKey, wrappedHandleSend]);

  const {
    handleNewChat,
    handleSelectSession,
    navigateToAgent,
    handleDeleteSession,
  } = useChatSessionActions({
    resolvedAgentId,
    activeThreadId,
    sessions,
    isMobile,
    setActiveAgent,
    setSidebarOpen,
    setSelectedModel,
    setHasBrowserTool,
    deleteSession,
    clearMessages,
    resetNavForAgentSwitch,
    markInitialNavDone,
  });

  useEffect(() => {
    return chatStore.onSlashAction((ev) => {
      if (ev.action === "switch_agent" && ev.agent_id) {
        navigateToAgent(ev.agent_id);
      }
    });
  }, [navigateToAgent]);

  // PoliceBuddy home launcher (spec §2.1.3): three read-only sources feed
  // the empty-session catalog; agent cards launch through the controller.
  const {
    state: homeCatalogState,
    sourceStatus: homeCatalogSourceStatus,
    reload: reloadCatalog,
    reloadSource: reloadCatalogSource,
  } = usePoliceHomeCatalog(resolvedAgentId ?? null);

  const homeAgentsByTemplate = useMemo(
    () =>
      homeCatalogState.status === "ready" ||
      homeCatalogState.status === "partial"
        ? homeCatalogState.data.agentsByTemplate
        : EMPTY_AGENTS_BY_TEMPLATE,
    [homeCatalogState],
  );

  const reloadCatalogInstances = useCallback(() => {
    reloadCatalogSource("instances" satisfies PoliceHomeSourceKey);
  }, [reloadCatalogSource]);

  const openNewSession = useCallback(
    (agentId: string, prefill: string) => {
      beginNavigationIntent();
      resetNavForAgentSwitch();
      const path = buildNewTaskPath(agentId);
      if (!path) return;
      navigate(path, {
        replace: true,
        state: prefill ? { prefillInput: prefill } : undefined,
      });
      setActiveAgent(agentId);
      clearMessages();
      if (isMobile) setSidebarOpen(false);
    },
    [
      navigate,
      resetNavForAgentSwitch,
      setActiveAgent,
      clearMessages,
      isMobile,
      setSidebarOpen,
    ],
  );

  const agentLaunch = usePoliceAgentLaunch({
    lang,
    agentsByTemplate: homeAgentsByTemplate,
    openNewSession,
    reloadInstances: reloadCatalogInstances,
  });

  const handleLaunchSkill = useCallback(
    (item: RecommendedSkill) => {
      launchRecommendedSkill(item, {
        lang,
        agentId: resolvedAgentId,
        chatSkills,
        onSkillsChange: handleSkillsChange,
        prefillComposer: (text) => chatInputRef.current?.setPrefillText(text),
      });
    },
    [lang, resolvedAgentId, chatSkills, handleSkillsChange],
  );

  const handlePromptClick = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (promptNeedsUserInput(text)) {
        prefillInputRef.current = trimmed;
        chatInputRef.current?.setPrefillText(trimmed);
        return;
      }
      wrappedHandleSend(trimmed);
    },
    [wrappedHandleSend],
  );

  const handleAcpPermissionSelect = useCallback(
    (permissionMessage: string) => {
      wrappedHandleSend(permissionMessage);
    },
    [wrappedHandleSend],
  );

  const handleHitlDecision = useCallback(
    (decisions: Array<{ type: string; message?: string }>) => {
      resumeHitl(decisions, activeThreadId ?? undefined);
    },
    [resumeHitl, activeThreadId],
  );

  useEffect(() => {
    let cancelled = false;
    browserApi
      .recordReplayStatus()
      .then((status) => {
        if (cancelled) return;
        setBrowserRecording(Boolean(status.active));
        setBrowserRecordingId(status.active?.recordingId ?? null);
        if (status.latestRecordingId) {
          setBrowserLastRecordingId(status.latestRecordingId);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Regenerate: re-send the last user message before this assistant message
  const handleRegenerate = useCallback(
    (messageId: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      // Find the user message that preceded this assistant response
      let userMsg: (typeof messages)[0] | undefined;
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userMsg = messages[i];
          break;
        }
      }
      if (!userMsg) return;
      wrappedHandleSend(userMsg.content, userMsg.attachments);
    },
    [messages, wrappedHandleSend],
  );

  // Edit user message: truncate history from that message onwards, replace
  // its content, and re-send — mirrors Claude / ChatGPT "edit message" behaviour.
  const handleEditUserMessage = useCallback(
    (messageId: string, newText: string) => {
      if (!activeThreadId) return;
      editAndResend(messageId, newText, "", resolvedAgentId ?? "");
    },
    [activeThreadId, editAndResend, resolvedAgentId],
  );

  const hasMessages = messages.length > 0;
  const workbenchLayout = useWorkbenchLayout();
  const {
    businessTag,
    setBusinessTag,
    activeAuxPanel,
    setActiveAuxPanel,
    setDirectoryOpen,
    setPreviewOpen,
    closeAuxPanel,
  } = useWorkbenchUi(workbenchLayout);
  const workbenchContext = useMemo(
    () =>
      resolvedAgentId
        ? { agentId: resolvedAgentId, threadId: activeThreadId }
        : null,
    [resolvedAgentId, activeThreadId],
  );
  const workbenchContextKey = workbenchContext
    ? makeContextKey(workbenchContext)
    : "";
  const previewController = useWorkbenchPreview(workbenchContextKey, {
    filePath: filePanelPath,
    handleClose: handleDockClose,
    clearPreviewSelection,
    openFileAt,
  });
  const { artifactChanges } = useTaskArtifacts(workbenchContext);
  const taskArtifactState = useMemo<
    ResourceState<readonly TaskArtifactItem[]>
  >(() => {
    if (!workbenchContext || artifactChanges.status === "idle") {
      return { status: "idle" };
    }
    if (
      artifactChanges.status === "ready" ||
      artifactChanges.status === "partial"
    ) {
      const data = projectTaskArtifacts(
        workbenchContext,
        artifactChanges.data,
      );
      if (artifactChanges.status === "partial") {
        return {
          status: "partial",
          data,
          loadedScope: artifactChanges.loadedScope,
        };
      }
      return data.length > 0
        ? { status: "ready", data }
        : { status: "empty" };
    }
    return { status: "empty" };
  }, [artifactChanges, workbenchContext]);
  const { applyChanges: applyPreviewChanges } = previewController;
  useEffect(() => {
    if (
      artifactChanges.status === "ready" ||
      artifactChanges.status === "partial"
    ) {
      applyPreviewChanges(artifactChanges.data);
    }
  }, [artifactChanges, applyPreviewChanges]);
  const handleOpenWorkbenchFile = useCallback(
    (path?: string | null) => {
      if (path) previewController.open(path);
      else openFilePanel();
      setPreviewOpen(true);
    },
    [previewController.open, openFilePanel, setPreviewOpen],
  );
  const handleStartWorkbench = useCallback(() => {
    const textarea =
      document.querySelector<HTMLTextAreaElement>("main textarea");
    textarea?.focus();
  }, []);

  useEffect(() => {
    const intent = (location.state as WorkbenchNavigationState | null)
      ?.workbenchIntent;
    if (!intent) return;
    navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: {},
      });
    if (intent === "new-task") {
      if (!explicitNewTask) handleNewChat();
    } else if (intent === "projects") {
      setSidebarOpen(true);
      setDirectoryOpen(true);
    } else if (intent === "library" && resolvedAgentId) {
      setPreviewOpen(true);
      openFilePanel();
    } else if (intent === "focus-composer") {
      handleStartWorkbench();
    }
  }, [
    location.state,
    location.pathname,
    location.search,
    navigate,
    explicitNewTask,
    handleNewChat,
    setSidebarOpen,
    resolvedAgentId,
    openFilePanel,
    handleStartWorkbench,
  ]);

  // 上下文切换：清除不属于新上下文的预览内容，保留各任务草稿。
  useEffect(() => {
    clearPreviewSelection();
  }, [workbenchContext, clearPreviewSelection]);

  return (
    <ChatFilePreviewProvider openFilePreview={handleOpenWorkbenchFile}>
      <PoliceWorkbenchShell
        skillRail={<PoliceSkillRail />}
        layout={workbenchLayout}
        activeAuxPanel={activeAuxPanel}
        onAuxPanelChange={setActiveAuxPanel}
        directory={
          <ChatSidebarPanel
            isMobile={isMobile}
            sidebarOpen={workbenchLayout.isWide || sidebarOpen}
            sidebarWidth={sidebarWidth}
            managed={!workbenchLayout.isWide}
            collapsible={!workbenchLayout.isWide}
            isSidebarResizing={isSidebarResizing}
            sidebarElRef={sidebarElRef}
            agents={agents}
            sessions={sessions}
            activeThreadId={activeThreadId}
            resolvedAgentId={resolvedAgentId}
            sessionsHasMore={sessionsHasMore}
            sessionsLoadingMore={sessionsLoadingMore}
            sessionsError={sessionsError}
            onRetrySessions={handleRetrySessions}
            onLoadMoreSessions={handleLoadMoreSessions}
            onFetchAllSessions={handleFetchAllSessions}
            onSelectSession={(sessionId, agentId) => {
              setActiveAgent(agentId);
              handleSelectSession(sessionId);
              if (!workbenchLayout.isWide) closeAuxPanel();
            }}
            onAgentSelect={navigateToAgent}
            onDeleteSession={handleDeleteSession}
            onRenameSession={renameSession}
            onPinSession={pinSession}
            onSidebarOpenChange={setSidebarOpen}
            onSidebarResizeStart={handleSidebarResizeStart}
          />
        }
        preview={
          <>
            <TaskResultPanel
              context={workbenchContext}
              artifacts={taskArtifactState}
              controller={previewController}
            />
            <ChatDockPanels
              slot="side"
              hasBrowserTool={hasBrowserTool}
              isMobile={isMobile}
              dockOpen={dockOpen}
              dockKind={dockKind}
              dockMode={dockMode}
              isResizing={dockIsResizing}
              panelSizes={dockPanelSizes}
              agentId={resolvedAgentId ?? ""}
              filePaths={panelFilePaths}
              initialPath={filePanelPath}
              revision={previewController.revision}
              browserSessionId={browserSessionId}
              browserEnvironment={browserEnvironment}
              browserSessionState={browserSessionState}
              browserControlOwner={browserControlOwner}
              onModeChange={handleDockModeChange}
              onClose={handleDockClose}
              onResizeStart={dockHandleResizeStart}
              onToggleBrowser={toggleBrowserPanel}
            />
          </>
        }
        statusBar={<WorkbenchStatusBar />}
      >
        {/* Main chat area */}
        <div
          className={`${styles.chatMain} ${
            dockOpen && dockMode === "bottom"
              ? styles.chatMainWithBottomPanel
              : ""
          } ${dockIsResizing ? styles.panelResizeActive : ""}`}
        >
          {/* Mobile toolbar — quick actions; global Header handles logo / health / theme */}
          {isMobile && (
            <div className={styles.mobileToolbar}>
              <button
                className={styles.menuBtn}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={t("nav.chatHistory") || "会话列表"}
              >
                <PanelLeftOpen size={18} strokeWidth={1.8} />
              </button>
              {resolvedAgentId && (
                <div className={styles.mobileToolbarRight}>
                  <button
                    className={styles.menuBtn}
                    onClick={() => setAgentProfileOpen(true)}
                    title={t("chat.agentProfile.open")}
                    aria-label={t("chat.agentProfile.open")}
                  >
                    <GraduationCap size={18} strokeWidth={1.8} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className={styles.chatContent}>
            {!agentChatReady || noAgents ? (
              <AgentNotReadyScreen
                agent={activeAgent}
                noAgents={noAgents}
                loading={agentsLoading}
              />
            ) : !hasMessages && !historyLoading ? (
              <WelcomeScreen
                agentName={activeAgent?.name ?? null}
                welcomeSuffix={welcomeSuffix}
                quickCards={[]}
                onPromptClick={handlePromptClick}
                hideMascot={isStreaming}
                newTask={explicitNewTask}
                workbenchOverview={
                  <PoliceHomeLauncher
                    state={homeCatalogState}
                    sourceStatus={homeCatalogSourceStatus}
                    onRetry={reloadCatalog}
                    onRetrySource={reloadCatalogSource}
                    onLaunchAgent={agentLaunch.launchAgentTemplate}
                    onLaunchSkill={handleLaunchSkill}
                    launchingAgentId={agentLaunch.launchingAgentId}
                  >
                    <WorkspaceOverview
                      agentId={resolvedAgentId ?? null}
                      context={workbenchContext}
                      businessTag={businessTag}
                      onBusinessTagChange={setBusinessTag}
                      onOpenFile={handleOpenWorkbenchFile}
                    />
                  </PoliceHomeLauncher>
                }
              />
            ) : (
              <MessageList
                messages={messages}
                composerLookups={composerLookups}
                loading={historyLoading}
                historyHasMore={historyHasMore}
                historyLoadingMore={historyLoadingMore}
                historyRefreshing={historyRefreshing}
                onLoadMoreHistory={() => void loadMoreHistory()}
                onRefreshHistory={() => void refreshHistory()}
                isStreaming={isStreaming}
                thinkingStartedAt={thinkingStartedAt}
                sessionKey={activeThreadId ?? undefined}
                onCancel={cancelStream}
                onRegenerate={handleRegenerate}
                onEditUserMessage={handleEditUserMessage}
                onAcpPermissionSelect={handleAcpPermissionSelect}
                onHitlDecision={handleHitlDecision}
                onOpenBrowser={
                  hasBrowserTool && !isMobile ? openBrowserPanel : undefined
                }
                onEditFile={
                  panelFilePaths.length > 0 && !isMobile
                    ? openFilePanel
                    : undefined
                }
              />
            )}
          </div>

          {resolvedAgentId && !isMobile && (
            <Tooltip title={t("chat.agentProfile.open")} mouseEnterDelay={0.35}>
              <span className={styles.agentProfileBtnWrap}>
                <button
                  type="button"
                  className={styles.agentProfileBtn}
                  onClick={() => setAgentProfileOpen(true)}
                  aria-label={t("chat.agentProfile.open")}
                >
                  <GraduationCap size={16} strokeWidth={2.25} />
                </button>
              </span>
            </Tooltip>
          )}

          <ChatComposerChrome sessionUsageLabel={sessionUsageLabel} />
          <ChatInput
            ref={chatInputRef}
            onSend={wrappedHandleSend}
            onCancel={cancelStream}
            onNewChat={handleNewChat}
            isStreaming={isStreaming}
            disabled={!agentChatReady || noAgents}
            initialText={prefillInputRef.current}
            availableModels={availableModels}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            availableConnectors={chatConnectors}
            selectedConnectors={selectedConnectors}
            onConnectorsChange={handleConnectorsChange}
            availableSkills={chatSkills}
            selectedSkills={selectedSkills}
            onSkillsChange={handleSkillsChange}
            availableAgents={chatAgentOptions}
            selectedTargetAgents={selectedTargetAgents}
            onTargetAgentsChange={setSelectedTargetAgents}
            agentId={resolvedAgentId}
            threadId={activeThreadId}
            defaultModel={activeAgent?.default_model ?? null}
            contextUsedTokens={contextUsedTokens}
            contextMaxTokens={contextMaxTokens}
            roleAgentId={resolvedAgentId ?? null}
            onRoleChange={navigateToAgent}
          />

          {/* Shared dock — bottom slot (file / browser / preview) */}
          <ChatDockPanels
            slot="bottom"
            hasBrowserTool={hasBrowserTool}
            isMobile={isMobile}
            dockOpen={dockOpen}
            dockKind={dockKind}
            dockMode={dockMode}
            isResizing={dockIsResizing}
            panelSizes={dockPanelSizes}
            agentId={resolvedAgentId ?? ""}
            filePaths={panelFilePaths}
            initialPath={filePanelPath}
            revision={previewController.revision}
            browserSessionId={browserSessionId}
            browserEnvironment={browserEnvironment}
            browserSessionState={browserSessionState}
            browserControlOwner={browserControlOwner}
            onModeChange={handleDockModeChange}
            onClose={handleDockClose}
            onResizeStart={dockHandleResizeStart}
            onToggleBrowser={toggleBrowserPanel}
          />
        </div>
      </PoliceWorkbenchShell>

      <AgentProfileDrawer
        open={agentProfileOpen}
        agent={activeAgent}
        isMobile={isMobile}
        onClose={() => setAgentProfileOpen(false)}
      />

      {/* Home launcher: create-from-template drawer (shared with Experts page). */}
      <CreateFromExpertDrawer
        open={agentLaunch.drawerOpen}
        expert={agentLaunch.drawerExpert}
        lang={lang}
        onClose={agentLaunch.closeDrawer}
        onCreated={agentLaunch.handleDrawerCreated}
      />

      {/* Home launcher: multi-instance disambiguation (user picks explicitly). */}
      <Modal
        open={agentLaunch.pendingSelection !== null}
        title={t("policeWorkbench.home.selectInstance")}
        onCancel={agentLaunch.cancelSelection}
        footer={null}
        width={440}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {(agentLaunch.pendingSelection?.instances ?? []).map((inst) => (
            <Button
              key={inst.agentId}
              block
              onClick={() => agentLaunch.chooseInstance(inst)}
            >
              {inst.name}
              <span style={{ opacity: 0.65, marginLeft: 8 }}>
                {formatAgentState(inst.state, t)}
              </span>
            </Button>
          ))}
        </Space>
      </Modal>
    </ChatFilePreviewProvider>
  );
}
