import type {
  SetupScope,
  SetupPendingInstallConfirmation,
  SetupStateSnapshot,
  SetupTargetId,
} from "../../setup/setup-contract.ts";
import {
  formatSetupTargetName,
  getSetupTargetDefinition,
} from "../../setup/setup-target-definitions.ts";

export type SetupItemViewModel = {
  id: SetupTargetId;
  title: string;
  description: string;
  status: "Missing" | "Installed";
  actionLabel: "Install" | "Reinstall";
};

export type SetupViewModel = {
  title: string;
  description: string;
  selectedScope: SetupScope;
  scopeOptions: Array<{
    value: SetupScope;
    label: string;
    isSelected: boolean;
  }>;
  scopeHint: string;
  isLoading: boolean;
  loadingLabel: string;
  items: SetupItemViewModel[];
  pendingInstallConfirmation?: {
    targetId: SetupTargetId;
    title: string;
    description: string;
    confirmLabel: string;
    targetLabel: string;
    scopeLabel: string;
    warningTitle: string;
    warningMessage: string;
  };
  feedback?: {
    kind: "success" | "error";
    message: string;
  };
};

export function buildSetupViewModel(snapshot: SetupStateSnapshot): SetupViewModel {
  return {
    title: "Agent setup",
    description: "Install Faro guidance for your coding agents directly from the extension.",
    selectedScope: snapshot.scope,
    scopeOptions: [
      {
        value: "local",
        label: "Local",
        isSelected: snapshot.scope === "local",
      },
      {
        value: "global",
        label: "Global",
        isSelected: snapshot.scope === "global",
      },
    ],
    scopeHint:
      snapshot.scope === "local"
        ? "Local writes repo-scoped integration files for this workspace."
        : "Global writes user-scoped integration files for your machine.",
    isLoading: snapshot.isLoading,
    loadingLabel: "Checking integrations...",
    items: snapshot.targets.map((target) => {
      const definition = getSetupTargetDefinition(target.id);
      return {
        id: target.id,
        title: definition.title,
        description: definition.description,
        status: target.status === "installed" ? "Installed" : "Missing",
        actionLabel: target.status === "installed" ? "Reinstall" : "Install",
      };
    }),
    pendingInstallConfirmation: buildPendingInstallConfirmation(
      snapshot.pendingInstallConfirmation,
      snapshot.scope,
      snapshot.targets,
    ),
    feedback: snapshot.feedback,
  };
}

function buildPendingInstallConfirmation(
  pendingInstallConfirmation: SetupPendingInstallConfirmation | undefined,
  scope: SetupScope,
  targets: SetupStateSnapshot["targets"],
): SetupViewModel["pendingInstallConfirmation"] {
  if (!pendingInstallConfirmation) {
    return undefined;
  }

  const target = targets.find((candidate) => candidate.id === pendingInstallConfirmation.targetId);
  if (!target) {
    return undefined;
  }

  const actionLabel = target.status === "installed" ? "Reinstall" : "Install";
  const targetLabel = formatSetupTargetName(target.id);
  const scopeLabel = scope === "local" ? "Local" : "Global";
  const scopeTarget = scope === "local" ? "workspace" : "user scope";
  const writeLocation = scope === "local"
    ? "repo-scoped integration files in this workspace"
    : "user-scoped integration files on this machine";
  const overwriteWarning = actionLabel === "Reinstall"
    ? "Reinstall may overwrite the Faro-managed block for this target."
    : "Install creates Faro-managed files for this target when they are missing.";

  return {
    targetId: target.id,
    title: `${actionLabel} ${targetLabel} for the ${scopeTarget}?`,
    description: "This action writes Faro-managed files before setup status refreshes.",
    confirmLabel: `Confirm ${actionLabel}`,
    targetLabel,
    scopeLabel,
    warningTitle: "Writes files",
    warningMessage: `Faro will update ${writeLocation}. ${overwriteWarning}`,
  };
}
