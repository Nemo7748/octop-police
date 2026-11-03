import { useTranslation } from "react-i18next";
import { FileText, X } from "lucide-react";
import type { ConversationReference } from "../workbenchTypes";
import wbStyles from "../workbench.module.less";

interface WorkspaceReferenceChipsProps {
  readonly references: readonly ConversationReference[];
  readonly invalidPaths?: readonly string[];
  readonly onRemove: (path: string) => void;
}

export default function WorkspaceReferenceChips({
  references,
  invalidPaths = [],
  onRemove,
}: WorkspaceReferenceChipsProps) {
  const { t } = useTranslation();
  if (references.length === 0) return null;
  return (
    <>
      {references.map((reference) => {
        const invalid = invalidPaths.includes(reference.path);
        return (
          <span
            key={reference.path}
            className={wbStyles.referenceChip}
            data-invalid={invalid}
            title={
              invalid
                ? `${reference.path} · ${t(
                    "policeWorkbench.references.invalid",
                  )}`
                : reference.path
            }
          >
            <FileText size={12} aria-hidden />
            <span className={wbStyles.referenceChipName}>{reference.name}</span>
            {invalid && (
              <span className={wbStyles.referenceChipInvalid}>
                {t("policeWorkbench.references.invalid")}
              </span>
            )}
            <button
              type="button"
              className={wbStyles.referenceChipRemove}
              aria-label={`${t("policeWorkbench.references.remove")} ${
                reference.name
              }`}
              onClick={() => onRemove(reference.path)}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
    </>
  );
}
