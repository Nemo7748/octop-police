import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import SessionList from "./SessionList";
import type { Session } from "../hooks/useSessions";
import type { ResourceError } from "../workbenchTypes";
import type { OctopAgent } from "../../../context/AgentContext";
import styles from "../index.module.less";

interface ChatSidebarPanelProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  isSidebarResizing?: boolean;
  sidebarElRef?: RefObject<HTMLDivElement>;
  managed?: boolean;
  collapsible?: boolean;
  agents: OctopAgent[];
  sessions: Session[];
  activeThreadId: string | null;
  resolvedAgentId: string | null | undefined;
  sessionsHasMore: boolean;
  sessionsLoadingMore: boolean;
  sessionsError?: ResourceError | null;
  onRetrySessions?: () => void;
  onLoadMoreSessions: () => void;
  onFetchAllSessions: () => void;
  onSelectSession: (sessionId: string, agentId: string) => void;
  onAgentSelect: (agentId: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onPinSession: (id: string, pinned: boolean) => void;
  onSidebarOpenChange: (open: boolean) => void;
  onSidebarResizeStart: (e: React.PointerEvent) => void;
}

export default function ChatSidebarPanel({
  isMobile,
  sidebarOpen,
  sidebarWidth,
  isSidebarResizing = false,
  sidebarElRef,
  managed = false,
  collapsible = true,
  agents,
  sessions,
  activeThreadId,
  resolvedAgentId,
  sessionsHasMore,
  sessionsLoadingMore,
  sessionsError = null,
  onRetrySessions,
  onLoadMoreSessions,
  onFetchAllSessions,
  onSelectSession,
  onAgentSelect,
  onDeleteSession,
  onRenameSession,
  onPinSession,
  onSidebarOpenChange,
  onSidebarResizeStart,
}: ChatSidebarPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.sidebarWrapper} ${
        !managed && !isMobile && !sidebarOpen
          ? styles.sidebarWrapperCollapsed
          : ""
      }`}
    >
      {!managed && isMobile && sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => onSidebarOpenChange(false)}
        />
      )}

      <div
        ref={sidebarElRef}
        className={`${styles.sidebar} ${
          managed || sidebarOpen ? styles.sidebarOpen : ""
        } ${isSidebarResizing ? styles.sidebarResizing : ""}`}
        style={
          managed
            ? { width: "100%", minWidth: 0 }
            : !isMobile && sidebarOpen
              ? { width: sidebarWidth, minWidth: sidebarWidth }
              : undefined
        }
      >
        <SessionList
          agents={agents}
          sessions={sessions}
          activeId={activeThreadId}
          activeAgentId={resolvedAgentId ?? null}
          hasMore={sessionsHasMore}
          loadingMore={sessionsLoadingMore}
          error={sessionsError}
          onRetry={onRetrySessions}
          onLoadMore={onLoadMoreSessions}
          onFetchAllSessions={onFetchAllSessions}
          onSelect={onSelectSession}
          onAgentSelect={onAgentSelect}
          onDelete={onDeleteSession}
          onRename={onRenameSession}
          onPin={onPinSession}
        />
        {!managed && !isMobile && sidebarOpen && (
          <div
            className={`${styles.sidebarResizeHandle} ${
              isSidebarResizing ? styles.sidebarResizeHandleActive : ""
            }`}
            onPointerDown={onSidebarResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("chat.resizeSidebar", "调整侧栏宽度")}
          />
        )}
      </div>

      {!managed && !isMobile && collapsible && (
        <Tooltip
          title={
            sidebarOpen
              ? t("chat.collapseHistorySidebar")
              : t("chat.expandHistorySidebar")
          }
          mouseEnterDelay={0.35}
        >
          <span
            className={`${styles.sidebarToggleWrap} ${
              !sidebarOpen ? styles.sidebarToggleWrapCollapsed : ""
            }`}
          >
            <button
              type="button"
              className={styles.sidebarToggleBtn}
              onClick={() => onSidebarOpenChange(!sidebarOpen)}
              aria-label={
                sidebarOpen
                  ? t("chat.collapseHistorySidebar")
                  : t("chat.expandHistorySidebar")
              }
            >
              {sidebarOpen ? (
                <PanelLeftClose size={16} strokeWidth={2} />
              ) : (
                <PanelLeftOpen size={16} strokeWidth={2} />
              )}
            </button>
          </span>
        </Tooltip>
      )}
    </div>
  );
}
