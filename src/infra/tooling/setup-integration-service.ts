import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";

import type {
  SetupScope,
  SetupTargetId,
  SetupTargetSnapshot,
} from "../../setup/setup-contract.ts";
import {
  buildGlobalCopilotInstructions,
  buildVsCodeCopilotAgent,
  resolveGlobalAgentInstructionPaths,
  resolveLocalAgentInstructionPaths,
  syncGlobalAgentInstructionTarget,
  syncLocalAgentInstructionTarget,
} from "./agent-instruction-sync.ts";

export type SetupIntegrationService = {
  loadTargets(scope: SetupScope): Promise<SetupTargetSnapshot[]>;
  installTarget(scope: SetupScope, targetId: SetupTargetId): Promise<void>;
};

type Options = {
  workspaceRoot: string;
  extensionRoot: string;
  codexHome?: string;
  claudeHome?: string;
  copilotHome?: string;
  readTextFile?(filePath: string): Promise<string>;
};

type InstructionSources = {
  agentsSource: string;
  skillSource: string;
};

export function createSetupIntegrationService({
  workspaceRoot,
  extensionRoot,
  codexHome = path.join(os.homedir(), ".codex"),
  claudeHome = path.join(os.homedir(), ".claude"),
  copilotHome = path.join(os.homedir(), ".copilot"),
  readTextFile = (filePath) => readFile(filePath, "utf8"),
}: Options): SetupIntegrationService {
  return {
    async loadTargets(scope) {
      const sources = await loadInstructionSources({
        extensionRoot,
        readTextFile,
      });
      const paths =
        scope === "local"
          ? resolveLocalAgentInstructionPaths(workspaceRoot)
          : resolveGlobalAgentInstructionPaths({
            codexHome,
            claudeHome,
            copilotHome,
          });

      const targets = await Promise.all(
        (Object.keys(paths) as SetupTargetId[]).map(async (targetId) => ({
          id: targetId,
          status: await detectTargetStatus({
            scope,
            targetId,
            targetPath: paths[targetId],
            sources,
            readTextFile,
          }),
        })),
      );

      return targets;
    },
    async installTarget(scope, targetId) {
      const sources = await loadInstructionSources({
        extensionRoot,
        readTextFile,
      });

      if (scope === "local") {
        await syncLocalAgentInstructionTarget({
          workspaceRoot,
          target: targetId,
          agentsSource: sources.agentsSource,
          skillSource: sources.skillSource,
        });
        return;
      }

      await syncGlobalAgentInstructionTarget({
        codexHome,
        claudeHome,
        copilotHome,
        target: targetId,
        agentsSource: sources.agentsSource,
        skillSource: sources.skillSource,
      });
    },
  };
}

async function loadInstructionSources({
  extensionRoot,
  readTextFile,
}: {
  extensionRoot: string;
  readTextFile(filePath: string): Promise<string>;
}): Promise<InstructionSources> {
  const agentsSource = await readTextFile(path.join(extensionRoot, "AGENTS.md"));
  const skillSource = await readTextFile(
    path.join(extensionRoot, "skills", "faro-author-paths", "SKILL.md"),
  );

  return {
    agentsSource,
    skillSource,
  };
}

async function detectTargetStatus({
  scope,
  targetId,
  targetPath,
  sources,
  readTextFile,
}: {
  scope: SetupScope;
  targetId: SetupTargetId;
  targetPath: string;
  sources: InstructionSources;
  readTextFile(filePath: string): Promise<string>;
}): Promise<"missing" | "installed"> {
  const existing = await readOptionalTextFile(targetPath, readTextFile);

  if (!existing) {
    return "missing";
  }

  if (targetId === "claude") {
    return existing.includes("<!-- FARO:BEGIN CLAUDE -->") ? "installed" : "missing";
  }

  if (targetId === "copilotInstructions") {
    if (scope === "local") {
      return existing.includes("<!-- FARO:BEGIN COPILOT -->") ? "installed" : "missing";
    }

    return existing === buildGlobalCopilotInstructions(sources) ? "installed" : "missing";
  }

  if (targetId === "copilotAgent") {
    return existing === buildVsCodeCopilotAgent(sources) ? "installed" : "missing";
  }

  if (targetId === "codexSkill") {
    return existing === sources.skillSource ? "installed" : "missing";
  }

  return "missing";
}

async function readOptionalTextFile(
  filePath: string,
  readTextFile: (filePath: string) => Promise<string>,
): Promise<string> {
  try {
    return await readTextFile(filePath);
  } catch {
    return "";
  }
}
