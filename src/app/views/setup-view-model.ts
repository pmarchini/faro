import type {
  SetupScope,
  SetupStateSnapshot,
  SetupTargetId,
} from "../../setup/setup-contract.ts";

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
  feedback?: {
    kind: "success" | "error";
    message: string;
  };
};

const SETUP_TARGET_DEFINITIONS: Record<
  SetupTargetId,
  Pick<SetupItemViewModel, "title" | "description">
> = {
  claude: {
    title: "Claude",
    description: "Create Faro-aware instructions for Claude in the selected scope.",
  },
  copilotInstructions: {
    title: "Copilot Instructions",
    description: "Keep VS Code Copilot aligned with Faro usage in the selected scope.",
  },
  copilotAgent: {
    title: "Copilot Agent",
    description: "Install the dedicated Faro Path Author agent profile for Copilot.",
  },
  codexSkill: {
    title: "Codex Skill",
    description: "Install the Faro authoring skill so Codex can generate and revise paths.",
  },
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
      const definition = SETUP_TARGET_DEFINITIONS[target.id];
      return {
        id: target.id,
        title: definition.title,
        description: definition.description,
        status: target.status === "installed" ? "Installed" : "Missing",
        actionLabel: target.status === "installed" ? "Reinstall" : "Install",
      };
    }),
    feedback: snapshot.feedback,
  };
}
