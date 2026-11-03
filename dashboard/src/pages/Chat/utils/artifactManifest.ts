import { normalizeWorkspacePath } from "./workbenchContext";

export const ARTIFACT_MANIFEST_FILENAME = "artifact.json";
export const ARTIFACT_MANIFEST_VERSION = 1;

export interface ArtifactManifestEntry {
  readonly path: string;
  readonly title?: string;
  readonly kind?: string;
}

export interface ArtifactManifest {
  readonly version: number;
  readonly primary: string;
  readonly artifacts: readonly ArtifactManifestEntry[];
}

export type ArtifactManifestParseResult =
  | {
      readonly status: "valid";
      readonly manifest: ArtifactManifest;
      readonly primaryPath: string;
    }
  | {
      readonly status: "invalid";
      readonly reason:
        | "malformed-json"
        | "unsupported-version"
        | "missing-primary"
        | "primary-escapes-directory"
        | "primary-outside-directory"
        | "malformed-artifacts";
    };

export function isManifestPath(path: string): boolean {
  const normalized = normalizeWorkspacePath(path);
  if (!normalized) return false;
  return normalized.endsWith("/artifact.json");
}

export function parseArtifactManifest(
  rawJson: string,
  manifestDir: string,
): ArtifactManifestParseResult {
  const normalizedDir = normalizeWorkspacePath(manifestDir);
  if (!normalizedDir) {
    return { status: "invalid", reason: "primary-outside-directory" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { status: "invalid", reason: "malformed-json" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { status: "invalid", reason: "malformed-json" };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.version !== ARTIFACT_MANIFEST_VERSION) {
    return { status: "invalid", reason: "unsupported-version" };
  }

  if (typeof obj.primary !== "string" || !obj.primary.trim()) {
    return { status: "invalid", reason: "missing-primary" };
  }

  const normalizedPrimary = normalizeWorkspacePath(obj.primary);
  if (!normalizedPrimary) {
    return { status: "invalid", reason: "primary-escapes-directory" };
  }

  const combined = normalizeWorkspacePath(`${normalizedDir}/${normalizedPrimary}`);
  if (!combined || !combined.startsWith(`${normalizedDir}/`)) {
    return { status: "invalid", reason: "primary-outside-directory" };
  }

  let artifacts: readonly ArtifactManifestEntry[] = [];
  if (obj.artifacts !== undefined) {
    if (!Array.isArray(obj.artifacts)) {
      return { status: "invalid", reason: "malformed-artifacts" };
    }
    artifacts = obj.artifacts.filter(
      (entry): entry is ArtifactManifestEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).path === "string" &&
        !!(entry as Record<string, unknown>).path,
    );
  }

  return {
    status: "valid",
    manifest: {
      version: ARTIFACT_MANIFEST_VERSION,
      primary: normalizedPrimary,
      artifacts,
    },
    primaryPath: combined,
  };
}