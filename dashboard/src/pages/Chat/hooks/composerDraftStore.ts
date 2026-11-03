import type { ChatAttachment } from "./sseHelpers";
import type { ConversationReference, ExecutionMode } from "../workbenchTypes";

export interface ComposerDraftData {
  readonly references: readonly ConversationReference[];
  readonly attachments: readonly ChatAttachment[];
  readonly mode: ExecutionMode;
  readonly pendingGuidance: readonly string[];
}

const EMPTY_DRAFT: ComposerDraftData = Object.freeze({
  references: [],
  attachments: [],
  mode: "act",
  pendingGuidance: [],
});

const drafts = new Map<string, ComposerDraftData>();
const listeners = new Map<string, Set<() => void>>();

function notify(contextKey: string): void {
  for (const listener of listeners.get(contextKey) ?? []) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

function update(
  contextKey: string,
  updater: (prev: ComposerDraftData) => ComposerDraftData,
): void {
  if (!contextKey) return;
  const next = updater(getSnapshot(contextKey));
  drafts.set(contextKey, next);
  notify(contextKey);
}

export function getSnapshot(contextKey: string): ComposerDraftData {
  return drafts.get(contextKey) ?? EMPTY_DRAFT;
}

export function subscribe(
  contextKey: string,
  listener: () => void,
): () => void {
  const set = listeners.get(contextKey) ?? new Set();
  set.add(listener);
  listeners.set(contextKey, set);
  return () => {
    set.delete(listener);
  };
}

export function setReferences(
  contextKey: string,
  references: readonly ConversationReference[],
): void {
  update(contextKey, (prev) => ({ ...prev, references }));
}

export function setAttachments(
  contextKey: string,
  attachments: readonly ChatAttachment[],
): void {
  update(contextKey, (prev) => ({ ...prev, attachments }));
}

export function setMode(contextKey: string, mode: ExecutionMode): void {
  update(contextKey, (prev) => ({ ...prev, mode }));
}

export function setPendingGuidance(
  contextKey: string,
  pendingGuidance: readonly string[],
): void {
  update(contextKey, (prev) => ({ ...prev, pendingGuidance }));
}

export interface SubmittedSnapshot {
  readonly references: readonly ConversationReference[];
  readonly attachments: readonly ChatAttachment[];
}

/** 发送回执只清理已提交快照，保留发送期间的新输入。 */
export function clearSubmittedSnapshot(
  contextKey: string,
  snapshot: SubmittedSnapshot,
): void {
  update(contextKey, (prev) => ({
    ...prev,
    references: prev.references.filter(
      (reference) =>
        !snapshot.references.some(
          (submitted) => submitted.path === reference.path,
        ),
    ),
    attachments: prev.attachments.filter(
      (attachment) =>
        !snapshot.attachments.some(
          (submitted) =>
            submitted.url === attachment.url &&
            submitted.workspacePath === attachment.workspacePath,
        ),
    ),
  }));
}

export function clearDraft(contextKey: string): void {
  drafts.delete(contextKey);
  notify(contextKey);
}

export function clearAllDrafts(): void {
  const keys = new Set([...drafts.keys(), ...listeners.keys()]);
  drafts.clear();
  for (const key of keys) notify(key);
}
if (typeof window !== "undefined") {
  window.addEventListener("octop:auth-cleared", () => {
    clearAllDrafts();
  });
}
