import { describe, expect, it } from "vitest";
import {
  applyTaskRunStatus,
  filterCatalogByName,
  projectSpaces,
  projectTasks,
  spacesResourceState,
  tasksResourceState,
} from "./workbenchCatalog";
import { stateCount } from "./workbenchContext";
import type { Session } from "../hooks/useSessions";

const sessions: Session[] = [
  {
    id: "t1",
    name: "案情分析",
    threadId: "t1",
    updatedAt: null,
    channelType: "dashboard",
    pinned: true,
  },
  {
    id: "t2",
    name: "文书生成",
    threadId: "t2",
    updatedAt: "2026-01-01T00:00:00.000Z",
    channelType: "dashboard",
  },
];

describe("workbenchCatalog 目录投影", () => {
  it("任务无历史运行状态或未读数据时显示未知/不提供未读", () => {
    const tasks = projectTasks(sessions, "a1");
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.status).toBe("unknown");
    expect(tasks[0]?.unreadCount).toBeNull();
    expect(tasks[0]?.agentId).toBe("a1");
    expect(tasks[0]?.pinned).toBe(true);
  });

  it("真实流状态可覆盖未知状态", () => {
    const tasks = projectTasks(sessions, "a1", (id) =>
      id === "t1" ? "running" : "unknown",
    );
    expect(tasks[0]?.status).toBe("running");
    const updated = applyTaskRunStatus(tasks, "t1", "done");
    expect(updated[0]?.status).toBe("done");
    expect(updated[1]?.status).toBe("unknown");
  });

  it("空间投影保留真实 unread 汇总", () => {
    const spaces = projectSpaces([
      { agent_id: "a1", name: "警务助理", state: "ready", unread_count: 3 },
      { agent_id: "a2", name: "内勤", state: "stopped" },
    ]);
    expect(spaces[0]?.unreadCount).toBe(3);
    expect(spaces[1]?.unreadCount).toBe(0);
  });

  it("名称搜索只筛选已加载项", () => {
    const tasks = projectTasks(sessions, "a1");
    expect(filterCatalogByName(tasks, "案情")).toHaveLength(1);
    expect(filterCatalogByName(tasks, "  ")).toHaveLength(2);
    expect(filterCatalogByName(tasks, "不存在")).toHaveLength(0);
    expect(filterCatalogByName(tasks, "CASE")).toHaveLength(0);
  });

  it("分页未完整时为 partial，数量不能当作真实总数", () => {
    const tasks = projectTasks(sessions, "a1");
    const partial = tasksResourceState(tasks, {
      loading: false,
      hasMore: true,
      loadedCount: 2,
    });
    expect(partial.status).toBe("partial");
    expect(stateCount(partial)).toBeNull();
    const complete = tasksResourceState(tasks, {
      loading: false,
      hasMore: false,
      loadedCount: 2,
    });
    expect(stateCount(complete)).toBe(2);
  });

  it("空与加载状态分离", () => {
    expect(
      tasksResourceState([], { loading: true, hasMore: false, loadedCount: 0 })
        .status,
    ).toBe("loading");
    expect(
      tasksResourceState([], { loading: false, hasMore: false, loadedCount: 0 })
        .status,
    ).toBe("empty");
    expect(spacesResourceState([], true).status).toBe("loading");
    expect(spacesResourceState([], false).status).toBe("empty");
  });
});
