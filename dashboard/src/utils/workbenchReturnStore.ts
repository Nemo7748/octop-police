import type { WorkbenchContextKey } from "../pages/Chat/workbenchTypes";

const STORAGE_KEY = "octop:police:workbench-return";
const STORAGE_VERSION = 1;

export interface WorkbenchReturnEntry {
  readonly path: string;
  readonly context: WorkbenchContextKey & { readonly threadId: string };
}

interface StoredWorkbenchReturn extends WorkbenchReturnEntry {
  readonly version: typeof STORAGE_VERSION;
}

function parseWorkbenchPath(pathname: string): WorkbenchReturnEntry | null {
  const match = /^\/chat\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  try {
    const agentId = decodeURIComponent(match[1] ?? "");
    const threadId = decodeURIComponent(match[2] ?? "");
    if (
      !agentId ||
      !threadId ||
      threadId === "__pending__" ||
      agentId.includes("/") ||
      threadId.includes("/")
    ) {
      return null;
    }
    return { path: pathname, context: { agentId, threadId } };
  } catch {
    return null;
  }
}

function parseStoredValue(value: unknown): WorkbenchReturnEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredWorkbenchReturn>;
  if (candidate.version !== STORAGE_VERSION) return null;
  if (typeof candidate.path !== "string" || !candidate.context) return null;
  const parsed = parseWorkbenchPath(candidate.path);
  if (!parsed) return null;
  if (
    candidate.context.agentId !== parsed.context.agentId ||
    candidate.context.threadId !== parsed.context.threadId
  ) {
    return null;
  }
  return parsed;
}

export function saveWorkbenchReturn(pathname: string): boolean {
  const parsed = parseWorkbenchPath(pathname);
  if (!parsed) return false;
  try {
    const stored: StoredWorkbenchReturn = {
      version: STORAGE_VERSION,
      ...parsed,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function readWorkbenchReturn(): WorkbenchReturnEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseStoredValue(JSON.parse(raw) as unknown);
    if (!parsed) sessionStorage.removeItem(STORAGE_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function clearWorkbenchReturn(pathname?: string): void {
  try {
    if (pathname) {
      const current = readWorkbenchReturn();
      if (current?.path !== pathname) return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("octop:auth-cleared", () => {
    clearWorkbenchReturn();
  });
}