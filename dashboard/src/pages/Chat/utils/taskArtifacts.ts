import { isWriteToolName } from "../constants";
import type { ChatMessage } from "../hooks/sseHelpers";
import type {
  ArtifactChange,
  ChangeKind,
  ChangeRecord,
  TaskArtifactItem,
  WorkbenchContextKey,
  WorkspaceArtifact,
} from "../workbenchTypes";
import { isProbablyText } from "../../Agent/Workspace/utils/fileKind";
import { getMediaKind } from "../../Agent/Workspace/utils/mediaKind";
import { getDocKind } from "../../Agent/Workspace/utils/docKind";
import {
  dedupeArtifacts,
  dedupeChanges,
  makeContextKey,
  normalizeWorkspacePath,
} from "./workbenchContext";

function isSuccessfulToolMessage(message: ChatMessage): boolean {
  if (!message.toolData) return false;
  if (message.toolData.errorCode) return false;
  if (
    typeof message.toolData.returnCode === "number" &&
    message.toolData.returnCode !== 0
  ) {
    return false;
  }
  return message.status !== "error";
}

function changeKindOf(toolName: string | undefined): ChangeKind {
  const name = toolName ?? "";
  if (/delete|remove|删除/i.test(name)) return "delete";
  if (/edit|编辑|改文件/i.test(name)) return "edit";
  return "write";
}

function extractToolPath(message: ChatMessage): string | null {
  const raw = message.toolData?.arguments;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["path", "file_path", "filepath", "filename"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    return null;
  }
  return null;
}

export function deriveChangesFromMessages(
  messages: readonly ChatMessage[],
): readonly ChangeRecord[] {
  const records: ChangeRecord[] = [];
  for (const message of messages) {
    if (!isWriteToolName(message.toolData?.name)) continue;
    if (!isSuccessfulToolMessage(message)) continue;
    const path = extractToolPath(message);
    if (!path) continue;
    records.push({
      callId: message.toolData?.callId ?? message.id,
      path,
      kind: changeKindOf(message.toolData?.name),
      occurredAt: message.timestamp
        ? new Date(message.timestamp).toISOString()
        : null,
    });
  }
  return dedupeChanges(records);
}

export function deriveArtifactsFromMessages(
  messages: readonly ChatMessage[],
): readonly WorkspaceArtifact[] {
  const artifacts: WorkspaceArtifact[] = [];
  for (const message of messages) {
    for (const attachment of message.attachments ?? []) {
      if (!attachment.workspacePath) continue;
      artifacts.push({
        path: attachment.workspacePath,
        name:
          attachment.filename ??
          attachment.workspacePath.split("/").pop() ??
          attachment.workspacePath,
        size: null,
        modifiedAt: null,
        source: "message",
      });
    }
    if (
      isWriteToolName(message.toolData?.name) &&
      isSuccessfulToolMessage(message)
    ) {
      const path = extractToolPath(message);
      if (path && !path.startsWith("file://")) {
        artifacts.push({
          path,
          name: path.split("/").pop() ?? path,
          size: null,
          modifiedAt: message.timestamp
            ? new Date(message.timestamp).toISOString()
            : null,
          source: "tool",
        });
      }
    }
  }
  return dedupeArtifacts(artifacts);
}

export function mergeTaskArtifacts(
  workspaceArtifacts: readonly WorkspaceArtifact[],
  messageArtifacts: readonly WorkspaceArtifact[],
): readonly WorkspaceArtifact[] {
  return dedupeArtifacts([...messageArtifacts, ...workspaceArtifacts]);
}
export function getArtifactPreviewCapability(
  path: string,
): TaskArtifactItem["previewCapability"] {
  const docKind = getDocKind(path);
  if (
    isProbablyText(path) ||
    getMediaKind(path) !== null ||
    (docKind !== null && docKind !== "ppt")
  ) {
    return "previewable";
  }
  return "unsupported";
}

export function projectTaskArtifacts(
  context: WorkbenchContextKey,
  changes: readonly ArtifactChange[],
): readonly TaskArtifactItem[] {
  const contextKey = makeContextKey(context);
  const byPath = new Map<string, TaskArtifactItem>();
  const seenChangeKeys = new Set<string>();

  for (const change of changes) {
    if (
      change.context.agentId !== context.agentId ||
      change.context.threadId !== context.threadId ||
      seenChangeKeys.has(change.changeKey)
    ) {
      continue;
    }
    seenChangeKeys.add(change.changeKey);
    const path = normalizeWorkspacePath(change.path);
    if (!path || isIgnoredArtifactPath(path)) continue;
    const previous = byPath.get(path);
    if (change.phase === "generating") {
      byPath.set(path, {
        contextKey,
        path,
        name: path.split("/").pop() ?? path,
        kind: change.kind,
        phase: "generating",
        revision: null,
        occurredAt: change.occurredAt,
        previewCapability: getArtifactPreviewCapability(path),
      });
      continue;
    }
    if (
      previous &&
      previous.phase !== "generating" &&
      previous.revision !== null &&
      change.revision <= previous.revision
    ) {
      continue;
    }
    byPath.set(path, {
      contextKey,
      path,
      name: path.split("/").pop() ?? path,
      kind: change.kind,
      phase: change.kind === "delete" ? "deleted" : "confirmed",
      revision: change.revision,
      occurredAt: change.occurredAt,
      previewCapability: getArtifactPreviewCapability(path),
    });
  }

  return Array.from(byPath.values());
}

function isIgnoredArtifactPath(normalizedPath: string): boolean {
  if (normalizedPath === "SOUL.md") return true;
  if (normalizedPath.startsWith("skills/")) return true;
  if (normalizedPath.startsWith("_builtin_skills/")) return true;
  if (normalizedPath.startsWith("agents/")) return true;
  if (normalizedPath.startsWith("inbound/")) return true;
  for (const segment of normalizedPath.split("/")) {
    if (segment.startsWith(".")) return true;
  }
  return false;
}

function isDeleteToolName(name: string | undefined): boolean {
  return /delete|remove|删除/i.test(name ?? "");
}

function isArtifactToolName(name: string | undefined): boolean {
  return isWriteToolName(name) || isDeleteToolName(name);
}

export function deriveArtifactChangesFromMessages(
  messages: readonly ChatMessage[],
  context: WorkbenchContextKey,
): readonly ArtifactChange[] {
  const changes: ArtifactChange[] = [];
  const seenKeys = new Set<string>();
  const confirmedRevisions = new Map<string, number>();
  for (const message of messages) {
    const toolName = message.toolData?.name;
    if (!isArtifactToolName(toolName)) continue;
    const rawPath = extractToolPath(message);
    if (!rawPath) continue;
    const normalized = normalizeWorkspacePath(rawPath);
    if (!normalized) continue;
    if (isIgnoredArtifactPath(normalized)) continue;

    const callId = message.toolData?.callId ?? message.id;
    const kind = changeKindOf(toolName);
    const occurredAt = message.timestamp
      ? new Date(message.timestamp).toISOString()
      : null;
    if (message.status === "streaming") {
      const key = `${callId}:${normalized}:generating`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        changes.push({
          context,
          path: normalized,
          kind,
          changeKey: key,
          occurredAt,
          phase: "generating",
          revision: null,
        });
      }
    }
    if (message.status !== "streaming" && isSuccessfulToolMessage(message)) {
      const key = `${callId}:${normalized}:confirmed`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const nextRevision = (confirmedRevisions.get(normalized) ?? 0) + 1;
        confirmedRevisions.set(normalized, nextRevision);
        changes.push({
          context,
          path: normalized,
          kind,
          changeKey: key,
          occurredAt,
          phase: "confirmed",
          revision: nextRevision,
        });
      }
    }
  }
  return changes;
}
