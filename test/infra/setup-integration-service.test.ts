import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createSetupIntegrationService } from "../../src/infra/tooling/setup-integration-service.ts";

const AGENTS_SOURCE = `# Faro Path Author Agent

Use MCP first.
`;

const SKILL_SOURCE = `---
name: faro-author-paths
---

# Faro Author Paths

Use faro.upsertPath.
`;

async function createSandbox() {
  const root = await mkdtemp(path.join(os.tmpdir(), "faro-setup-service-"));
  const workspaceRoot = path.join(root, "workspace");
  const extensionRoot = path.join(root, "extension");
  const codexHome = path.join(root, ".codex");
  const claudeHome = path.join(root, ".claude");
  const copilotHome = path.join(root, ".copilot");

  await mkdir(path.join(extensionRoot, "skills", "faro-author-paths"), { recursive: true });
  await writeFile(path.join(extensionRoot, "AGENTS.md"), AGENTS_SOURCE, "utf8");
  await writeFile(
    path.join(extensionRoot, "skills", "faro-author-paths", "SKILL.md"),
    SKILL_SOURCE,
    "utf8",
  );

  return {
    root,
    workspaceRoot,
    extensionRoot,
    codexHome,
    claudeHome,
    copilotHome,
  };
}

test("loadTargets reports missing targets for local and global scope before installation", async () => {
  const sandbox = await createSandbox();
  const service = createSetupIntegrationService({
    workspaceRoot: sandbox.workspaceRoot,
    extensionRoot: sandbox.extensionRoot,
    codexHome: sandbox.codexHome,
    claudeHome: sandbox.claudeHome,
    copilotHome: sandbox.copilotHome,
  });

  const localTargets = await service.loadTargets("local");
  const globalTargets = await service.loadTargets("global");

  assert.deepEqual(localTargets, [
    { id: "claude", status: "missing" },
    { id: "copilotInstructions", status: "missing" },
    { id: "copilotAgent", status: "missing" },
    { id: "codexSkill", status: "missing" },
  ]);
  assert.deepEqual(globalTargets, [
    { id: "claude", status: "missing" },
    { id: "copilotInstructions", status: "missing" },
    { id: "copilotAgent", status: "missing" },
    { id: "codexSkill", status: "missing" },
  ]);
});

test("installTarget installs one local target and refreshes its status only", async () => {
  const sandbox = await createSandbox();
  const service = createSetupIntegrationService({
    workspaceRoot: sandbox.workspaceRoot,
    extensionRoot: sandbox.extensionRoot,
    codexHome: sandbox.codexHome,
    claudeHome: sandbox.claudeHome,
    copilotHome: sandbox.copilotHome,
  });

  await service.installTarget("local", "claude");

  const targets = await service.loadTargets("local");

  assert.deepEqual(targets, [
    { id: "claude", status: "installed" },
    { id: "copilotInstructions", status: "missing" },
    { id: "copilotAgent", status: "missing" },
    { id: "codexSkill", status: "missing" },
  ]);
});

test("installTarget installs one global target and refreshes its status only", async () => {
  const sandbox = await createSandbox();
  const service = createSetupIntegrationService({
    workspaceRoot: sandbox.workspaceRoot,
    extensionRoot: sandbox.extensionRoot,
    codexHome: sandbox.codexHome,
    claudeHome: sandbox.claudeHome,
    copilotHome: sandbox.copilotHome,
  });

  await service.installTarget("global", "codexSkill");

  const targets = await service.loadTargets("global");

  assert.deepEqual(targets, [
    { id: "claude", status: "missing" },
    { id: "copilotInstructions", status: "missing" },
    { id: "copilotAgent", status: "missing" },
    { id: "codexSkill", status: "installed" },
  ]);
});
