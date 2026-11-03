import type { WorkspaceDirectoryEntryDto } from "../../../api/types";
import type { ChatAttachment } from "../hooks/sseHelpers";
import { agentAttachmentAccessUrl } from "../../../utils/toolMediaBlocks";
import type {
  ConversationReference,
  WorkspaceArtifact,
} from "../workbenchTypes";
import { isConversationFilePath } from "./workbenchContext";

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

export function referenceToAttachment(
  agentId: string,
  reference: ConversationReference,
): ChatAttachment {
  const isImage = IMAGE_EXTENSION_RE.test(reference.path);
  return {
    url: agentAttachmentAccessUrl(agentId, reference.path),
    filename: reference.name,
    workspacePath: reference.path,
    kind: isImage ? "image" : "file",
  };
}

export function parentDirectoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : ".";
}

export function groupByParentDirectory(
  references: readonly ConversationReference[],
): ReadonlyMap<string, readonly ConversationReference[]> {
  const groups = new Map<string, ConversationReference[]>();
  for (const reference of references) {
    const parent = parentDirectoryOf(reference.path);
    const existing = groups.get(parent) ?? [];
    existing.push(reference);
    groups.set(parent, existing);
  }
  return groups;
}

export interface ReferenceValidationResult {
  readonly valid: readonly ConversationReference[];
  readonly invalid: readonly ConversationReference[];
}

export function validateReferencesAgainstListings(
  references: readonly ConversationReference[],
  listingsByParent: ReadonlyMap<string, readonly WorkspaceDirectoryEntryDto[]>,
): ReferenceValidationResult {
  const valid: ConversationReference[] = [];
  const invalid: ConversationReference[] = [];
  for (const reference of references) {
    const entries = listingsByParent.get(parentDirectoryOf(reference.path));
    const exists = entries?.some(
      (entry) => !entry.is_dir && entry.name === reference.name,
    );
    if (exists) {
      valid.push(reference);
    } else {
      invalid.push(reference);
    }
  }
  return { valid, invalid };
}

export function artifactToReference(
  artifact: WorkspaceArtifact,
): ConversationReference | null {
  if (!isConversationFilePath(artifact.path)) return null;
  return { path: artifact.path, name: artifact.name, kind: "file" };
}

export function dedupeReferences(
  references: readonly ConversationReference[],
): readonly ConversationReference[] {
  const byPath = new Map<string, ConversationReference>();
  for (const reference of references) {
    if (!isConversationFilePath(reference.path)) continue;
    if (!byPath.has(reference.path)) byPath.set(reference.path, reference);
  }
  return Array.from(byPath.values());
}
