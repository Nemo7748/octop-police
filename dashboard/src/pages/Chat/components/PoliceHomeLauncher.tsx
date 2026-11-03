/**
 * PoliceBuddy home-catalog launcher (empty-session view).
 *
 * Renders, in order: the "police-development" agent group (5 cards), the
 * "web-workbench" group (6 cards), the recommended builtin skills (up to 6
 * cards) and — collapsed by default — the existing task/file overview passed
 * in as ``children``. All data comes from ``usePoliceHomeCatalog``; nothing
 * is hardcoded and clicking a card never sends a message (launch controllers
 * own that behaviour). Design: spec §2.1.3.A.3 / §2.1.3.C-D.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, FolderOpen, Scale, ScanText } from "lucide-react";
import { pickLocale } from "../../../utils/localizedText";
import { iconForName } from "../../Experts/components/iconForName";
import type { ResourceState } from "../workbenchTypes";
import {
  isCatalogUnsupported,
  type PoliceAgentSummary,
  type PoliceHomeCatalog,
  type PoliceHomeSourceKey,
  type PoliceHomeSourceStatus,
  type RecommendedSkill,
} from "../hooks/usePoliceHomeCatalog";
import workbenchStyles from "../workbench.module.less";
import styles from "./PoliceHomeLauncher.module.less";

// Builtin police skills use a few lucide names the shared expert icon map
// does not register; fall back to ``iconForName`` (Layers) for anything else.
const SKILL_ICON_OVERRIDES: Record<string, (size: number) => ReactNode> = {
  briefcase: (size) => <Briefcase size={size} />,
  "folder-open": (size) => <FolderOpen size={size} />,
  "scan-text": (size) => <ScanText size={size} />,
  scale: (size) => <Scale size={size} />,
};

function skillIcon(name: string, size = 20): ReactNode {
  const override = SKILL_ICON_OVERRIDES[name];
  return override ? override(size) : iconForName(name, size);
}

export interface PoliceHomeLauncherProps {
  readonly state: ResourceState<PoliceHomeCatalog>;
  readonly sourceStatus: Record<PoliceHomeSourceKey, PoliceHomeSourceStatus>;
  /** Re-fetch every source (global error / retry affordance). */
  readonly onRetry: () => void;
  /** Re-fetch a single failed source while the rest of the page renders. */
  readonly onRetrySource: (key: PoliceHomeSourceKey) => void;
  /** Agent card click — launch controller decides create/reuse/select. */
  readonly onLaunchAgent: (item: PoliceAgentSummary) => void;
  /** Skill card click — selects the slug for this turn and prefills. */
  readonly onLaunchSkill: (item: RecommendedSkill) => void;
  /** Template id currently creating an instance (shows "creating…"). */
  readonly launchingAgentId: string | null;
  /** Collapsed-by-default overview content (task summary / files). */
  readonly children?: ReactNode;
}

function AgentCard({
  agent,
  lang,
  actionLabel,
  launching,
  noDescriptionLabel,
  onLaunch,
}: {
  agent: PoliceAgentSummary;
  lang: "zh" | "en";
  actionLabel: string;
  launching: boolean;
  noDescriptionLabel: string;
  onLaunch: (item: PoliceAgentSummary) => void;
}) {
  const color = agent.color || "#E85D75";
  const title = pickLocale(agent.label, lang) || agent.expertId;
  const description =
    pickLocale(agent.description, lang) || noDescriptionLabel;
  return (
    <button
      type="button"
      className={`${workbenchStyles.card} ${styles.agentCard}`}
      data-agent-id={agent.expertId}
      disabled={launching}
      onClick={() => onLaunch(agent)}
    >
      <span
        className={styles.cardIcon}
        style={{ color, background: `${color}1a` }}
        aria-hidden
      >
        {iconForName(agent.iconName, 22)}
      </span>
      <span className={styles.cardTitle} title={title}>
        {title}
      </span>
      <span className={styles.cardDescription}>{description}</span>
      <span className={styles.cardAction}>{actionLabel}</span>
    </button>
  );
}

function SkillCard({
  skill,
  noDescriptionLabel,
  onLaunch,
}: {
  skill: RecommendedSkill;
  noDescriptionLabel: string;
  onLaunch: (item: RecommendedSkill) => void;
}) {
  return (
    <button
      type="button"
      className={`${workbenchStyles.card} ${styles.skillCard}`}
      data-skill-slug={skill.slug}
      onClick={() => onLaunch(skill)}
    >
      <span
        className={styles.cardIcon}
        style={{ color: skill.homeColor, background: `${skill.homeColor}1a` }}
        aria-hidden
      >
        {skillIcon(skill.homeIconName, 20)}
      </span>
      <span className={styles.cardTitle} title={skill.name}>
        {skill.name}
      </span>
      <span className={styles.cardDescription}>
        {skill.description || noDescriptionLabel}
      </span>
    </button>
  );
}

function SkeletonSection({ cards }: { cards: number }) {
  return (
    <div className={styles.group} aria-hidden>
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <div className={styles.agentGrid}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
        ))}
      </div>
    </div>
  );
}

export default function PoliceHomeLauncher({
  state,
  sourceStatus,
  onRetry,
  onRetrySource,
  onLaunchAgent,
  onLaunchSkill,
  launchingAgentId,
  children,
}: PoliceHomeLauncherProps) {
  const { t, i18n } = useTranslation();
  const lang: "zh" | "en" = i18n.language?.startsWith("zh") ? "zh" : "en";
  const launchLabel = t("policeWorkbench.home.launch");
  const creatingLabel = t("policeWorkbench.home.creating");
  const noDescriptionLabel = t("policeWorkbench.home.noDescription");

  if (state.status === "loading") {
    return (
      <div
        className={styles.launcher}
        data-testid="police-home-skeleton"
        aria-busy="true"
      >
        <SkeletonSection cards={5} />
        <SkeletonSection cards={6} />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className={styles.launcher} data-testid="police-home-empty">
        <p className={workbenchStyles.briefEmpty}>
          {t("policeWorkbench.home.emptyCatalog")}
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    if (isCatalogUnsupported(state)) {
      return (
        <div className={styles.launcher} data-testid="police-home-unsupported">
          <p className={workbenchStyles.briefEmpty}>
            {t("policeWorkbench.home.catalogUnsupported")}
          </p>
        </div>
      );
    }
    return (
      <div className={styles.launcher} data-testid="police-home-error">
        <div className={workbenchStyles.errorRow}>
          <span>{t("policeWorkbench.home.loadFailed")}</span>
          <button
            type="button"
            className={workbenchStyles.fileLink}
            onClick={onRetry}
          >
            {t("policeWorkbench.home.retry")}
          </button>
        </div>
      </div>
    );
  }

  const data = state.data;


  return (
    <div className={styles.launcher} data-testid="police-home-launcher">
      {state.status === "partial" && sourceStatus.instances === "error" && (
        <div className={workbenchStyles.errorRow} data-testid="home-instances-error">
          <span>{t("policeWorkbench.home.loadFailed")}</span>
          <button
            type="button"
            className={workbenchStyles.fileLink}
            onClick={() => onRetrySource("instances")}
          >
            {t("policeWorkbench.home.retry")}
          </button>
        </div>
      )}

      {data.agentGroups.map((group) => (
        <section key={group.group} className={styles.group}>
          <h2 className={styles.groupTitle}>
            {t(`policeWorkbench.home.groups.${group.group}`)}
          </h2>
          <div className={styles.agentGrid}>
            {group.agents.map((agent) => (
              <AgentCard
                key={agent.expertId}
                agent={agent}
                lang={lang}
                actionLabel={
                  launchingAgentId === agent.expertId ? creatingLabel : launchLabel
                }
                launching={launchingAgentId === agent.expertId}
                noDescriptionLabel={noDescriptionLabel}
                onLaunch={onLaunchAgent}
              />
            ))}
          </div>
        </section>
      ))}

      <section className={styles.group} data-testid="home-skills">
        <h2 className={styles.groupTitle}>
          {t("policeWorkbench.home.skillsTitle")}
        </h2>
        <p className={styles.groupHint}>
          {t("policeWorkbench.home.skillsSubtitle")}
        </p>
        {sourceStatus.skills === "error" ? (
          <div className={workbenchStyles.errorRow} data-testid="home-skills-error">
            <span>{t("policeWorkbench.home.loadFailed")}</span>
            <button
              type="button"
              className={workbenchStyles.fileLink}
              onClick={() => onRetrySource("skills")}
            >
              {t("policeWorkbench.home.retry")}
            </button>
          </div>
        ) : data.recommendedSkills.length === 0 ? (
          <p className={workbenchStyles.briefEmpty}>
            {t("policeWorkbench.home.noSkills")}
          </p>
        ) : (
          <div className={styles.skillGrid}>
            {data.recommendedSkills.map((skill) => (
              <SkillCard
                key={skill.slug}
                skill={skill}
                noDescriptionLabel={noDescriptionLabel}
                onLaunch={onLaunchSkill}
              />
            ))}
          </div>
        )}
      </section>

      {children && (
        <details className={styles.collapse} data-testid="home-collapse">
          <summary className={styles.collapseSummary}>
            {t("policeWorkbench.home.overviewTitle")}
          </summary>
          <div className={styles.collapseBody}>{children}</div>
        </details>
      )}

    </div>
  );
}