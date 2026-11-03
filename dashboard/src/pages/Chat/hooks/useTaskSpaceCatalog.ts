import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAgent } from "../../../context/AgentContext";
import * as chatStore from "./chatStore";
import { useSessions } from "./useSessions";
import {
  projectSpaces,
  projectTasks,
  spacesResourceState,
  tasksResourceState,
} from "../utils/workbenchCatalog";
import type {
  ResourceState,
  SpaceCatalogItem,
  TaskCatalogItem,
  TaskRunStatus,
} from "../workbenchTypes";

export interface TaskSpaceCatalog {
  readonly tasks: ResourceState<readonly TaskCatalogItem[]>;
  readonly spaces: ResourceState<readonly SpaceCatalogItem[]>;
  readonly tasksHasMore: boolean;
  readonly tasksLoadedCount: number;
  readonly selectTask: (agentId: string, threadId: string) => void;
  readonly selectSpace: (agentId: string) => void;
  readonly createTask: () => void;
  readonly retry: (group: "tasks" | "spaces") => Promise<void>;
  readonly loadMoreTasks: () => Promise<void>;
}

export function taskRunStatusOf(threadId: string): TaskRunStatus {
  return chatStore.getSnapshot(threadId).runStatus;
}

export function useTaskSpaceCatalog(
  routeAgentId: string | null,
): TaskSpaceCatalog {
  const navigate = useNavigate();
  const {
    agents,
    activeAgentId,
    setActiveAgent,
    refresh: refreshAgents,
    loading: agentsLoading,
  } = useAgent();
  const resolvedAgentId = routeAgentId ?? activeAgentId ?? null;
  const {
    sessions,
    loading: sessionsLoading,
    hasMore,
    fetchSessions,
    loadMoreSessions,
  } = useSessions(resolvedAgentId);

  const tasks = useMemo(() => {
    const projected = resolvedAgentId
      ? projectTasks(sessions, resolvedAgentId, taskRunStatusOf)
      : [];
    return tasksResourceState(projected, {
      loading: sessionsLoading,
      hasMore,
      loadedCount: sessions.length,
    });
  }, [sessions, resolvedAgentId, sessionsLoading, hasMore]);

  const spaces = useMemo(
    () => spacesResourceState(projectSpaces(agents), agentsLoading),
    [agents, agentsLoading],
  );

  const selectTask = useCallback(
    (agentId: string, threadId: string) => {
      if (agentId !== activeAgentId) setActiveAgent(agentId);
      navigate(`/chat/${agentId}/${threadId}`);
    },
    [activeAgentId, setActiveAgent, navigate],
  );

  const selectSpace = useCallback(
    (agentId: string) => {
      if (agentId !== activeAgentId) setActiveAgent(agentId);
      navigate(`/chat/${agentId}`);
    },
    [activeAgentId, setActiveAgent, navigate],
  );

  const createTask = useCallback(() => {
    if (!resolvedAgentId) return;
    navigate(`/chat/${resolvedAgentId}`);
  }, [navigate, resolvedAgentId]);

  const retry = useCallback(
    async (group: "tasks" | "spaces") => {
      if (group === "spaces") {
        await refreshAgents();
      } else {
        await fetchSessions();
      }
    },
    [refreshAgents, fetchSessions],
  );

  const loadMoreTasks = useCallback(async () => {
    await loadMoreSessions();
  }, [loadMoreSessions]);

  return {
    tasks,
    spaces,
    tasksHasMore: hasMore,
    tasksLoadedCount: sessions.length,
    selectTask,
    selectSpace,
    createTask,
    retry,
    loadMoreTasks,
  };
}
