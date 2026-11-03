import type { Session } from "../hooks/useSessions";
import type {
  ResourceState,
  SpaceCatalogItem,
  TaskCatalogItem,
  TaskRunStatus,
} from "../workbenchTypes";
import {
  collectionState,
  emptyState,
  loadingState,
  partialState,
  readyState,
} from "./workbenchContext";

export interface AgentLike {
  readonly agent_id: string;
  readonly name: string;
  readonly state: string;
  readonly unread_count?: number;
}

export function projectTasks(
  sessions: readonly Session[],
  agentId: string,
  statusOf?: (threadId: string) => TaskRunStatus,
): readonly TaskCatalogItem[] {
  return sessions.map((session) => ({
    agentId,
    threadId: session.threadId,
    name: session.name,
    updatedAt: session.updatedAt,
    status: statusOf?.(session.threadId) ?? "unknown",
    unreadCount: null,
    pinned: Boolean(session.pinned),
  }));
}

export function projectSpaces(
  agents: readonly AgentLike[],
): readonly SpaceCatalogItem[] {
  return agents.map((agent) => ({
    agentId: agent.agent_id,
    name: agent.name,
    state: agent.state,
    unreadCount: agent.unread_count ?? 0,
  }));
}

export function filterCatalogByName<T extends { readonly name: string }>(
  items: readonly T[],
  query: string,
): readonly T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => item.name.toLowerCase().includes(normalized));
}

export interface CatalogStateInput {
  readonly loading: boolean;
  readonly hasMore: boolean;
  readonly loadedCount: number;
}

export function tasksResourceState(
  tasks: readonly TaskCatalogItem[],
  input: CatalogStateInput,
): ResourceState<readonly TaskCatalogItem[]> {
  if (input.loading && tasks.length === 0) return loadingState();
  if (tasks.length === 0) return emptyState();
  if (input.hasMore) {
    return partialState(tasks, String(input.loadedCount));
  }
  return readyState(tasks);
}

export function spacesResourceState(
  spaces: readonly SpaceCatalogItem[],
  loading: boolean,
): ResourceState<readonly SpaceCatalogItem[]> {
  if (loading && spaces.length === 0) return loadingState();
  return collectionState(spaces);
}

export function applyTaskRunStatus(
  tasks: readonly TaskCatalogItem[],
  threadId: string,
  status: TaskRunStatus,
): readonly TaskCatalogItem[] {
  return tasks.map((task) =>
    task.threadId === threadId ? { ...task, status } : task,
  );
}
