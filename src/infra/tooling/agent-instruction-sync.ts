import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

type SyncAgentInstructionsOptions = {
  workspaceRoot: string;
  codexHome?: string;
  claudeHome?: string;
  copilotHome?: string;
  force?: boolean;
  agentsSource: string;
  skillSource: string;
};

type InstructionSources = {
  agentsSource: string;
  skillSource: string;
};

export type AgentInstructionTargetId =
  | "claude"
  | "copilotInstructions"
  | "copilotAgent"
  | "codexSkill";

export async function syncAgentInstructions({
  workspaceRoot,
  codexHome = path.join(os.homedir(), ".codex"),
  claudeHome = path.join(os.homedir(), ".claude"),
  copilotHome = path.join(os.homedir(), ".copilot"),
  force = false,
  agentsSource,
  skillSource,
}: SyncAgentInstructionsOptions): Promise<void> {
  await syncLocalAgentInstructions({
    workspaceRoot,
    agentsSource,
    skillSource,
  });
  await syncGlobalAgentInstructions({
    codexHome,
    claudeHome,
    copilotHome,
    force,
    agentsSource,
    skillSource,
  });
}

export async function syncLocalAgentInstructions({
  workspaceRoot,
  agentsSource,
  skillSource,
}: {
  workspaceRoot: string;
} & InstructionSources): Promise<void> {
  const claudePath = path.join(workspaceRoot, "CLAUDE.md");
  const copilotPath = path.join(workspaceRoot, ".github", "copilot-instructions.md");
  const codexSkillPath = path.join(workspaceRoot, ".codex", "skills", "faro-author-paths", "SKILL.md");

  await mkdir(path.dirname(claudePath), { recursive: true });
  await mkdir(path.dirname(copilotPath), { recursive: true });
  await mkdir(path.dirname(codexSkillPath), { recursive: true });

  const claudeExisting = await readOptionalFile(claudePath);
  const copilotExisting = await readOptionalFile(copilotPath);

  await writeFile(
    claudePath,
    upsertManagedMarkdownSection({
      existingContent: claudeExisting,
      blockId: "CLAUDE",
      content: buildClaudeInstructions({
        agentsSource,
        skillSource,
      }),
    }),
    "utf8",
  );
  await writeFile(
    copilotPath,
    upsertManagedMarkdownSection({
      existingContent: copilotExisting,
      blockId: "COPILOT",
      content: buildCopilotInstructions({
        agentsSource,
        skillSource,
      }),
    }),
    "utf8",
  );
  await syncVsCodeCopilotAgent({
    workspaceRoot,
    agentsSource,
    skillSource,
  });
  await writeFile(codexSkillPath, skillSource, "utf8");
}

export async function syncLocalAgentInstructionTarget({
  workspaceRoot,
  target,
  agentsSource,
  skillSource,
}: {
  workspaceRoot: string;
  target: AgentInstructionTargetId;
} & InstructionSources): Promise<void> {
  const paths = resolveLocalAgentInstructionPaths(workspaceRoot);

  await mkdir(path.dirname(paths.claude), { recursive: true });
  await mkdir(path.dirname(paths.copilotInstructions), { recursive: true });
  await mkdir(path.dirname(paths.codexSkill), { recursive: true });

  if (target === "claude") {
    const existingContent = await readOptionalFile(paths.claude);
    await writeFile(
      paths.claude,
      upsertManagedMarkdownSection({
        existingContent,
        blockId: "CLAUDE",
        content: buildClaudeInstructions({
          agentsSource,
          skillSource,
        }),
      }),
      "utf8",
    );
    return;
  }

  if (target === "copilotInstructions") {
    const existingContent = await readOptionalFile(paths.copilotInstructions);
    await writeFile(
      paths.copilotInstructions,
      upsertManagedMarkdownSection({
        existingContent,
        blockId: "COPILOT",
        content: buildCopilotInstructions({
          agentsSource,
          skillSource,
        }),
      }),
      "utf8",
    );
    return;
  }

  if (target === "copilotAgent") {
    await syncVsCodeCopilotAgent({
      workspaceRoot,
      agentsSource,
      skillSource,
    });
    return;
  }

  await writeFile(paths.codexSkill, skillSource, "utf8");
}

export async function syncGlobalAgentInstructions({
  codexHome = path.join(os.homedir(), ".codex"),
  claudeHome = path.join(os.homedir(), ".claude"),
  copilotHome = path.join(os.homedir(), ".copilot"),
  force = false,
  agentsSource,
  skillSource,
}: {
  codexHome?: string;
  claudeHome?: string;
  copilotHome?: string;
  force?: boolean;
  agentsSource: string;
  skillSource: string;
}): Promise<void> {
  const codexSkillPath = path.join(codexHome, "skills", "faro-author-paths", "SKILL.md");
  const claudePath = path.join(claudeHome, "CLAUDE.md");
  const copilotInstructionsPath = path.join(copilotHome, "instructions", "faro.instructions.md");
  const copilotAgentPath = path.join(copilotHome, "agents", "faro-path-author.agent.md");

  await mkdir(path.dirname(codexSkillPath), { recursive: true });
  await mkdir(path.dirname(claudePath), { recursive: true });
  await mkdir(path.dirname(copilotInstructionsPath), { recursive: true });
  await mkdir(path.dirname(copilotAgentPath), { recursive: true });

  const claudeExisting = await readOptionalFile(claudePath);

  await writeFile(
    claudePath,
    upsertManagedMarkdownSection({
      existingContent: claudeExisting,
      blockId: "CLAUDE",
      content: buildClaudeInstructions({
        agentsSource,
        skillSource,
      }),
    }),
    "utf8",
  );
  await writeFaroOwnedFile({
    filePath: copilotInstructionsPath,
    content: buildGlobalCopilotInstructions({ agentsSource, skillSource }),
    force,
  });
  await writeFaroOwnedFile({
    filePath: copilotAgentPath,
    content: buildVsCodeCopilotAgent({ agentsSource, skillSource }),
    force,
  });
  await writeFile(codexSkillPath, skillSource, "utf8");
}

export async function syncGlobalAgentInstructionTarget({
  codexHome = path.join(os.homedir(), ".codex"),
  claudeHome = path.join(os.homedir(), ".claude"),
  copilotHome = path.join(os.homedir(), ".copilot"),
  force = false,
  target,
  agentsSource,
  skillSource,
}: {
  codexHome?: string;
  claudeHome?: string;
  copilotHome?: string;
  force?: boolean;
  target: AgentInstructionTargetId;
} & InstructionSources): Promise<void> {
  const paths = resolveGlobalAgentInstructionPaths({
    codexHome,
    claudeHome,
    copilotHome,
  });

  await mkdir(path.dirname(paths.claude), { recursive: true });
  await mkdir(path.dirname(paths.copilotInstructions), { recursive: true });
  await mkdir(path.dirname(paths.copilotAgent), { recursive: true });
  await mkdir(path.dirname(paths.codexSkill), { recursive: true });

  if (target === "claude") {
    const existingContent = await readOptionalFile(paths.claude);
    await writeFile(
      paths.claude,
      upsertManagedMarkdownSection({
        existingContent,
        blockId: "CLAUDE",
        content: buildClaudeInstructions({
          agentsSource,
          skillSource,
        }),
      }),
      "utf8",
    );
    return;
  }

  if (target === "copilotInstructions") {
    await writeFaroOwnedFile({
      filePath: paths.copilotInstructions,
      content: buildGlobalCopilotInstructions({
        agentsSource,
        skillSource,
      }),
      force,
    });
    return;
  }

  if (target === "copilotAgent") {
    await writeFaroOwnedFile({
      filePath: paths.copilotAgent,
      content: buildVsCodeCopilotAgent({
        agentsSource,
        skillSource,
      }),
      force,
    });
    return;
  }

  await writeFile(paths.codexSkill, skillSource, "utf8");
}

export function buildClaudeInstructions({
  agentsSource,
  skillSource,
}: InstructionSources): string {
  return `# CLAUDE.md

This file is generated by Faro.
Source files:
- AGENTS.md
- skills/faro-author-paths/SKILL.md

Claude Code should treat AGENTS.md and the Faro skill as the source of truth for authoring Faro paths.
Prefer MCP-driven Faro workflows when the runtime exposes \`faro.*\` operations.

## Embedded AGENTS.md

${agentsSource.trim()}

## Embedded SKILL.md

${skillSource.trim()}
`;
}

export function buildCopilotInstructions({
  agentsSource,
  skillSource,
}: InstructionSources): string {
  return `# Faro Agent Instructions

This file is generated by Faro.
AGENTS.md remains the source of truth for the agent role.
The Faro skill remains the source of truth for authoring behavior.

When GitHub Copilot can access the Faro MCP surface:

1. Start with \`faro.listPaths\`.
2. Use \`faro.getPath\` before revising an existing path.
3. Prefer one \`faro.upsertPath\` whole-path write.
4. Use \`faro.setActivePath\` only when the new path should become primary.
5. Use \`faro.setCurrentBeacon\` only when the starting step should move.

Keep Faro paths linear for the current MVP.
Do not invent a parallel schema.
Do not modify source code just to fit a path.

## AGENTS Summary

${agentsSource.trim()}

## SKILL Summary

${skillSource.trim()}
`;
}

export function buildGlobalCopilotInstructions({
  agentsSource,
  skillSource,
}: InstructionSources): string {
  return `---
name: Faro Global Instructions
description: Global guidance for Faro path authoring across workspaces.
applyTo: "**"
---

# Faro Global Instructions

Apply these instructions when authoring or revising Faro paths.

- Start with \`faro.listPaths\` when the Faro MCP surface is available.
- Use \`faro.getPath\` before revising an existing path.
- Prefer one \`faro.upsertPath\` whole-path write.
- Keep paths linear for the current MVP.
- Do not change source code just to fit a path.

## AGENTS Source

${agentsSource.trim()}

## SKILL Source

${skillSource.trim()}
`;
}

export async function syncVsCodeCopilotAgent({
  workspaceRoot,
  agentsSource,
  skillSource,
}: {
  workspaceRoot: string;
} & InstructionSources): Promise<void> {
  const copilotAgentPath = path.join(
    workspaceRoot,
    ".github",
    "agents",
    "faro-path-author.agent.md",
  );

  await mkdir(path.dirname(copilotAgentPath), { recursive: true });
  await writeFile(
    copilotAgentPath,
    buildVsCodeCopilotAgent({
      agentsSource,
      skillSource,
    }),
    "utf8",
  );
}

export function resolveLocalAgentInstructionPaths(workspaceRoot: string): Record<
  AgentInstructionTargetId,
  string
> {
  return {
    claude: path.join(workspaceRoot, "CLAUDE.md"),
    copilotInstructions: path.join(workspaceRoot, ".github", "copilot-instructions.md"),
    copilotAgent: path.join(workspaceRoot, ".github", "agents", "faro-path-author.agent.md"),
    codexSkill: path.join(workspaceRoot, ".codex", "skills", "faro-author-paths", "SKILL.md"),
  };
}

export function resolveGlobalAgentInstructionPaths({
  codexHome = path.join(os.homedir(), ".codex"),
  claudeHome = path.join(os.homedir(), ".claude"),
  copilotHome = path.join(os.homedir(), ".copilot"),
}: {
  codexHome?: string;
  claudeHome?: string;
  copilotHome?: string;
} = {}): Record<AgentInstructionTargetId, string> {
  return {
    claude: path.join(claudeHome, "CLAUDE.md"),
    copilotInstructions: path.join(copilotHome, "instructions", "faro.instructions.md"),
    copilotAgent: path.join(copilotHome, "agents", "faro-path-author.agent.md"),
    codexSkill: path.join(codexHome, "skills", "faro-author-paths", "SKILL.md"),
  };
}

export function buildVsCodeCopilotAgent({
  agentsSource,
  skillSource,
}: InstructionSources): string {
  return `---
name: Faro Path Author
description: Use the Faro MCP tools to author or revise one temporary comprehension path.
tools: ['faro.local/*']
---

# Faro Path Author

Use this agent when the goal is to turn code understanding into one clear Faro path for a human reader.

## Operating Rules

- Use the Faro MCP tools before proposing manual JSON edits.
- Keep the path linear for the current MVP.
- Prefer one whole-path \`faro.upsertPath\` write.
- Do not change source code just to fit the path.
- If the runtime is unavailable, still return valid Faro data using the canonical schema.

## AGENTS Source

${agentsSource.trim()}

## SKILL Source

${skillSource.trim()}
`;
}

export function upsertManagedMarkdownSection({
  existingContent,
  blockId,
  content,
}: {
  existingContent: string;
  blockId: string;
  content: string;
}): string {
  const begin = `<!-- FARO:BEGIN ${blockId} -->`;
  const end = `<!-- FARO:END ${blockId} -->`;
  const block = `${begin}\n${content.trim()}\n${end}`;
  const pattern = new RegExp(`${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}`, "m");

  if (!existingContent.trim()) {
    return `${block}\n`;
  }

  if (pattern.test(existingContent)) {
    return existingContent.replace(pattern, block);
  }

  return `${existingContent.trimEnd()}\n\n${block}\n`;
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function writeFaroOwnedFile({
  filePath,
  content,
  force,
}: {
  filePath: string;
  content: string;
  force: boolean;
}): Promise<void> {
  const existingContent = await readOptionalFile(filePath);

  if (existingContent && existingContent !== content && !force) {
    throw new Error(`Refusing to overwrite existing Faro global file: ${filePath}. Re-run with --force.`);
  }

  await writeFile(filePath, content, "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
