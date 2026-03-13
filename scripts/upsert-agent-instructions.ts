import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  syncGlobalAgentInstructions,
  syncAgentInstructions,
  syncLocalAgentInstructions,
  syncVsCodeCopilotAgent,
} from "../src/infra/tooling/agent-instruction-sync.ts";

async function main(): Promise<void> {
  const workspaceRoot = process.cwd();
  const codexHome = process.env.CODEX_HOME;
  const scope = readRequiredScope(process.argv.slice(2));
  const copilotAgentOnly = process.argv.includes("--copilot-agent-only");
  const agentsSource = await readFile(path.join(workspaceRoot, "AGENTS.md"), "utf8");
  const skillSource = await readFile(
    path.join(workspaceRoot, "skills", "faro-author-paths", "SKILL.md"),
    "utf8",
  );

  if (copilotAgentOnly) {
    if (scope !== "local") {
      throw new Error("The Faro VS Code Copilot custom agent is a local artifact. Use --scope=local.");
    }
    await syncVsCodeCopilotAgent({
      workspaceRoot,
      agentsSource,
      skillSource,
    });
    process.stdout.write("Upserted the Faro VS Code Copilot custom agent.\n");
    return;
  }

  if (scope === "local") {
    await syncLocalAgentInstructions({
      workspaceRoot,
      agentsSource,
      skillSource,
    });
    process.stdout.write("Upserted local Faro agent instructions.\n");
    return;
  }

  if (scope === "global") {
    await syncGlobalAgentInstructions({
      codexHome,
      skillSource,
    });
    process.stdout.write("Upserted global Faro agent instructions.\n");
    return;
  }

  await syncAgentInstructions({
    workspaceRoot,
    codexHome,
    agentsSource,
    skillSource,
  });
  process.stdout.write("Upserted local and global Faro agent instructions.\n");
}

function readRequiredScope(argv: string[]): "local" | "global" | "all" {
  const rawScope = argv.find((value) => value.startsWith("--scope="));
  const scope = rawScope?.slice("--scope=".length);

  if (scope === "local" || scope === "global" || scope === "all") {
    return scope;
  }

  throw new Error("Missing or invalid --scope argument. Use --scope=local, --scope=global, or --scope=all.");
}

void main();
