import type {
  ChangeRecord,
  TaskBrief,
  WorkspaceArtifact,
} from "../workbenchTypes";

const DELIVERED_TITLES = [
  "本次已交付",
  "Delivered",
  "Delivered This Session",
] as const;
const NEXT_STEPS_TITLES = [
  "下次回来做什么",
  "Next Steps",
  "What To Do Next",
] as const;
const MATERIALS_TITLES = [
  "需带来的材料",
  "Materials",
  "Materials To Bring",
] as const;

export function extractReadmeSection(
  content: string,
  titles: readonly string[],
): readonly string[] {
  if (!content.trim()) return [];
  const wanted = new Set(titles.map((title) => title.trim().toLowerCase()));
  const lines = content.split(/\r?\n/);
  const items: string[] = [];
  let collecting = false;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const title = heading[2]?.trim().toLowerCase() ?? "";
      collecting = wanted.has(title);
      continue;
    }
    if (!collecting) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const item = bullet?.[1] ?? numbered?.[1] ?? trimmed;
    if (item) items.push(item.trim());
  }
  return items;
}

export function projectTaskBrief(
  readmeContent: string | null,
  changes: readonly ChangeRecord[],
  artifacts: readonly WorkspaceArtifact[],
): TaskBrief {
  const deliveredFromReadme = readmeContent
    ? extractReadmeSection(readmeContent, DELIVERED_TITLES)
    : [];
  const delivered =
    deliveredFromReadme.length > 0
      ? deliveredFromReadme
      : dedupeNames([
          ...changes.map((change) => change.path),
          ...artifacts.map((artifact) => artifact.name),
        ]);
  return {
    delivered,
    nextSteps: readmeContent
      ? extractReadmeSection(readmeContent, NEXT_STEPS_TITLES)
      : [],
    requiredMaterials: readmeContent
      ? extractReadmeSection(readmeContent, MATERIALS_TITLES)
      : [],
  };
}

function dedupeNames(names: readonly string[]): readonly string[] {
  return Array.from(new Set(names.filter((name) => name.trim().length > 0)));
}
