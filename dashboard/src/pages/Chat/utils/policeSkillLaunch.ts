/**
 * PoliceBuddy recommended-skill launch (spec §2.1.3.C / §2.2.2.D).
 *
 * A home skill-card click is a pure per-turn action: validate the current
 * agent and the skill slug, replace the per-turn skill selection with the
 * clicked slug (reusing the existing ``handleSkillsChange`` — the empty
 * array still means "disable all skills this turn" and is never emitted
 * here), prefill the localized prompt into the composer and focus it.
 * Nothing is auto-sent and the skill's global enable/disable state is not
 * touched. If the skill disappeared or got disabled (e.g. after an
 * instance switch), the existing resource validation owns removal; this
 * function simply reports ``unavailable`` and performs no side effects.
 */

import type { SkillSpec } from "../../Agent/Skills/useSkills";
import { pickLocale } from "../../../utils/localizedText";
import type { RecommendedSkill } from "../hooks/usePoliceHomeCatalog";

export type SkillLaunchResult =
  | { kind: "prefilled"; slug: string }
  | {
      kind: "unavailable";
      reason: "no-agent" | "skill-missing" | "skill-disabled";
    };

export interface SkillLaunchContext {
  readonly lang: "zh" | "en";
  /** Current agent id; ``null``/``undefined`` when no usable instance. */
  readonly agentId: string | null | undefined;
  /** Skills loaded for the current agent, with their enabled flag. */
  readonly chatSkills: readonly SkillSpec[];
  /** Replace the per-turn skill selection (existing ``handleSkillsChange``). */
  readonly onSkillsChange: (slugs: string[]) => void;
  /** Push text into the mounted composer; focus without sending. */
  readonly prefillComposer: (text: string) => void;
}

export function launchRecommendedSkill(
  item: RecommendedSkill,
  ctx: SkillLaunchContext,
): SkillLaunchResult {
  if (!ctx.agentId) {
    return { kind: "unavailable", reason: "no-agent" };
  }
  const spec = ctx.chatSkills.find((s) => s.slug === item.slug);
  if (!spec) {
    return { kind: "unavailable", reason: "skill-missing" };
  }
  if (!spec.enabled) {
    return { kind: "unavailable", reason: "skill-disabled" };
  }
  ctx.onSkillsChange([item.slug]);
  ctx.prefillComposer(pickLocale(item.homePrompt, ctx.lang));
  return { kind: "prefilled", slug: item.slug };
}