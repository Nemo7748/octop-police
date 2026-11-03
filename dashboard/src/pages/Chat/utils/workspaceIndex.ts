import type { WorkspaceDirectoryEntryDto } from "../../../api/types";
import type { WorkspaceArtifact } from "../workbenchTypes";
import {
  isConversationFilePath,
  isReadmePath,
  normalizeWorkspacePath,
} from "./workbenchContext";

export const WORKSPACE_INDEX_MAX_DEPTH = 4;
export const WORKSPACE_INDEX_MAX_DIRS = 50;

export function entryToArtifact(
  entry: WorkspaceDirectoryEntryDto,
): WorkspaceArtifact | null {
  if (entry.is_dir) return null;
  const normalized = normalizeWorkspacePath(entry.path || entry.name);
  if (!normalized) return null;
  return {
    path: normalized,
    name: entry.name || normalized.split("/").pop() || normalized,
    size: entry.size ?? null,
    modifiedAt: entry.modified_time ?? null,
    source: "workspace",
  };
}

export function entryDirectoryPath(
  entry: WorkspaceDirectoryEntryDto,
): string | null {
  if (!entry.is_dir) return null;
  return normalizeWorkspacePath(entry.path || entry.name);
}

export function findDefaultReadme(
  artifacts: readonly WorkspaceArtifact[],
): WorkspaceArtifact | null {
  const readmes = artifacts.filter((artifact) => isReadmePath(artifact.path));
  if (readmes.length === 0) return null;
  const root = readmes.find((artifact) => !artifact.path.includes("/"));
  return root ?? readmes[0] ?? null;
}

export function conversationFileCandidates(
  artifacts: readonly WorkspaceArtifact[],
): readonly WorkspaceArtifact[] {
  return artifacts.filter((artifact) => isConversationFilePath(artifact.path));
}

export function shouldRecurseDirectory(
  depth: number,
  visitedDirs: number,
): boolean {
  return (
    depth < WORKSPACE_INDEX_MAX_DEPTH && visitedDirs < WORKSPACE_INDEX_MAX_DIRS
  );
}
