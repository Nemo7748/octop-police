import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { workspaceApi } from "../../../api/modules/workspace";
import * as composerDraftStore from "./composerDraftStore";
import { useWorkspaceIndex } from "./useWorkspaceIndex";
import { makeContextKey } from "../utils/workbenchContext";
import {
  dedupeReferences,
  groupByParentDirectory,
  validateReferencesAgainstListings,
  type ReferenceValidationResult,
} from "../utils/conversationReferences";
import type { ConversationReference } from "../workbenchTypes";

const EMPTY_REFERENCES: readonly ConversationReference[] = Object.freeze([]);

export function useConversationReferences(
  agentId: string | null | undefined,
  threadId: string | null | undefined,
) {
  const contextKey = agentId
    ? makeContextKey({ agentId, threadId: threadId ?? null })
    : "";
  const index = useWorkspaceIndex({
    agentId: agentId ?? null,
    enabled: Boolean(agentId),
  });
  const [invalidPaths, setInvalidPaths] = useState<readonly string[]>([]);

  const references = useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        contextKey
          ? composerDraftStore.subscribe(contextKey, listener)
          : () => undefined,
      [contextKey],
    ),
    useCallback(
      () =>
        contextKey
          ? composerDraftStore.getSnapshot(contextKey).references
          : EMPTY_REFERENCES,
      [contextKey],
    ),
  );

  const files = useMemo<readonly ConversationReference[]>(
    () =>
      index.conversationFiles.map((artifact) => ({
        path: artifact.path,
        name: artifact.name,
        kind: "file" as const,
      })),
    [index.conversationFiles],
  );

  const addReference = useCallback(
    (reference: ConversationReference) => {
      if (!contextKey) return;
      composerDraftStore.setReferences(
        contextKey,
        dedupeReferences([
          ...composerDraftStore.getSnapshot(contextKey).references,
          reference,
        ]),
      );
      setInvalidPaths((prev) => prev.filter((path) => path !== reference.path));
    },
    [contextKey],
  );

  const removeReference = useCallback(
    (path: string) => {
      if (!contextKey) return;
      composerDraftStore.setReferences(
        contextKey,
        composerDraftStore
          .getSnapshot(contextKey)
          .references.filter((reference) => reference.path !== path),
      );
      setInvalidPaths((prev) => prev.filter((item) => item !== path));
    },
    [contextKey],
  );

  const validateReferences = useCallback(
    async (agentIdOverride?: string): Promise<ReferenceValidationResult> => {
      const agent = agentIdOverride ?? agentId;
      const current = contextKey
        ? composerDraftStore.getSnapshot(contextKey).references
        : [];
      if (!agent || current.length === 0) {
        return { valid: current, invalid: [] };
      }
      const groups = groupByParentDirectory(current);
      const listings = new Map<
        string,
        Awaited<ReturnType<typeof workspaceApi.listAgentDirectory>>
      >();
      try {
        await Promise.all(
          Array.from(groups.keys()).map(async (parent) => {
            const entries = await workspaceApi.listAgentDirectory(
              agent,
              parent,
            );
            listings.set(parent, entries);
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
      const result = validateReferencesAgainstListings(current, listings);
      setInvalidPaths(result.invalid.map((reference) => reference.path));
      return result;
    },
    [agentId, contextKey],
  );

  return {
    references,
    files,
    invalidPaths,
    addReference,
    removeReference,
    validateReferences,
  };
}
