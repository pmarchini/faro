import assert from "node:assert/strict";
import test from "node:test";

import { buildSetupViewModel } from "../../src/app/views/setup-view-model.ts";

test("buildSetupViewModel maps selected scope and target statuses into render labels", () => {
  const viewModel = buildSetupViewModel({
    scope: "local",
    isLoading: false,
    targets: [
      {
        id: "claude",
        status: "missing",
      },
      {
        id: "copilotInstructions",
        status: "installed",
      },
    ],
  });

  assert.equal(viewModel.selectedScope, "local");
  assert.deepEqual(
    viewModel.scopeOptions.map((option) => ({
      value: option.value,
      isSelected: option.isSelected,
    })),
    [
      { value: "local", isSelected: true },
      { value: "global", isSelected: false },
    ],
  );
  assert.equal(viewModel.scopeHint, "Local writes repo-scoped integration files for this workspace.");
  assert.deepEqual(viewModel.items, [
    {
      id: "claude",
      title: "Claude",
      description: "Create Faro-aware instructions for Claude in the selected scope.",
      status: "Missing",
      actionLabel: "Install",
    },
    {
      id: "copilotInstructions",
      title: "Copilot Instructions",
      description: "Keep VS Code Copilot aligned with Faro usage in the selected scope.",
      status: "Installed",
      actionLabel: "Reinstall",
    },
  ]);
});

test("buildSetupViewModel exposes loading and feedback without changing the target contract", () => {
  const viewModel = buildSetupViewModel({
    scope: "global",
    isLoading: true,
    targets: [],
    feedback: {
      kind: "success",
      message: "Installed Claude.",
    },
  });

  assert.equal(viewModel.selectedScope, "global");
  assert.equal(viewModel.isLoading, true);
  assert.equal(viewModel.loadingLabel, "Checking integrations...");
  assert.deepEqual(viewModel.feedback, {
    kind: "success",
    message: "Installed Claude.",
  });
  assert.equal(viewModel.scopeHint, "Global writes user-scoped integration files for your machine.");
});
