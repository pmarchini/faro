import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  syncAgentInstructions,
  syncVsCodeCopilotAgent,
} from "../src/infra/tooling/agent-instruction-sync.ts";

async function main(): Promise<void> {
  const workspaceRoot = process.cwd();
  const codexHome = process.env.CODEX_HOME;
  const copilotAgentOnly = process.argv.includes("--copilot-agent-only");
  const agentsSource = await readFile(path.join(workspaceRoot, "AGENTS.md"), "utf8");
  const skillSource = await readFile(
    path.join(workspaceRoot, "skills", "faro-author-paths", "SKILL.md"),
    "utf8",
  );

  if (copilotAgentOnly) {
    await syncVsCodeCopilotAgent({
      workspaceRoot,
      agentsSource,
      skillSource,
    });
    process.stdout.write("Upserted the Faro VS Code Copilot custom agent.\n");
    return;
  }

  await syncAgentInstructions({
    workspaceRoot,
    codexHome,
    agentsSource,
    skillSource,
  });

  process.stdout.write("Upserted Claude, Copilot, VS Code custom agent, and Codex Faro instructions.\n");
}

void main();
