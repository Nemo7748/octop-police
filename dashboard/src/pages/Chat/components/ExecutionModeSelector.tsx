import { useTranslation } from "react-i18next";
import type { ExecutionMode } from "../workbenchTypes";
import wbStyles from "../workbench.module.less";

const MODES: readonly ExecutionMode[] = ["ask", "act", "plan"];

interface ExecutionModeSelectorProps {
  readonly value: ExecutionMode;
  readonly onChange: (mode: ExecutionMode) => void;
  readonly disabled?: boolean;
}

export default function ExecutionModeSelector({
  value,
  onChange,
  disabled = false,
}: ExecutionModeSelectorProps) {
  const { t } = useTranslation();
  return (
    <div
      className={wbStyles.modeSelector}
      role="group"
      aria-label={t("policeWorkbench.plan.title")}
      data-testid="execution-mode-selector"
    >
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={wbStyles.tag}
          data-active={value === mode}
          aria-pressed={value === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
        >
          {t(`policeWorkbench.modes.${mode}`)}
        </button>
      ))}
    </div>
  );
}
