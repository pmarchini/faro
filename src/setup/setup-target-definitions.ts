import type { SetupTargetId } from "./setup-contract.ts";

export type SetupTargetDefinition = {
  title: string;
  description: string;
};

const SETUP_TARGET_DEFINITIONS: Record<SetupTargetId, SetupTargetDefinition> = {
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

export function getSetupTargetDefinition(targetId: SetupTargetId): SetupTargetDefinition {
  return SETUP_TARGET_DEFINITIONS[targetId];
}

export function formatSetupTargetName(targetId: SetupTargetId): string {
  return getSetupTargetDefinition(targetId).title;
}
