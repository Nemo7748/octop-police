import { useTranslation } from "react-i18next";
import { usePoliceNavigation } from "../../../hooks/usePoliceNavigation";
import styles from "../workbench.module.less";

interface RoleOption {
  readonly agent_id: string;
  readonly name: string;
}

interface RoleSelectorProps {
  readonly agents: readonly RoleOption[];
  readonly value: string | null;
  readonly onChange: (agentId: string) => void;
  readonly disabled?: boolean;
}

export default function RoleSelector({
  agents,
  value,
  onChange,
  disabled = false,
}: RoleSelectorProps) {
  const { t } = useTranslation();
  const navigation = usePoliceNavigation();

  if (agents.length === 0) {
    return (
      <span className={styles.metaEmpty} data-testid="role-selector-empty">
        <span>{t("policeWorkbench.composer.noRole")}</span>
        <button
          type="button"
          className={styles.fileLink}
          onClick={() =>
            navigation.navigate({
              sourceEntry: "role-selector.configure",
              capabilityId: "experts",
            })
          }
        >
          {t("policeWorkbench.composer.configure")}
        </button>
      </span>
    );
  }

  return (
    <label className={styles.metaField}>
      <span className={styles.metaLabel}>
        {t("policeWorkbench.composer.role")}
      </span>
      <select
        className={styles.metaSelect}
        aria-label={t("policeWorkbench.composer.selectRole")}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      >
        {value === null && <option value="" disabled />}
        {agents.map((agent) => (
          <option key={agent.agent_id} value={agent.agent_id}>
            {agent.name}
          </option>
        ))}
      </select>
    </label>
  );
}
