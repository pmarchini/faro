import assert from "node:assert/strict";
import test from "node:test";

import { createWorkspaceUiState } from "../../src/infra/vscode/workspace-ui-state.ts";

function createMemento(initialEntries: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>(Object.entries(initialEntries));

  return {
    get(key: string) {
      return values.get(key);
    },
    update(key: string, value: unknown) {
      values.set(key, value);
      return Promise.resolve();
    },
    snapshot(key: string) {
      return values.get(key);
    },
  };
}

test("workspace ui state defaults welcome to visible", () => {
  const memento = createMemento();
  const uiState = createWorkspaceUiState({ memento });

  assert.deepEqual(uiState.load(), {
    welcomeDismissed: false,
    selectedMainRoute: "home",
  });
});

test("workspace ui state persists welcome dismissal", async () => {
  const memento = createMemento();
  const uiState = createWorkspaceUiState({ memento });

  await uiState.dismissWelcome();

  assert.deepEqual(uiState.load(), {
    welcomeDismissed: true,
    selectedMainRoute: "home",
  });
  assert.deepEqual(memento.snapshot("faro.ui"), {
    welcomeDismissed: true,
    selectedMainRoute: "home",
  });

  const reloaded = createWorkspaceUiState({ memento });
  assert.deepEqual(reloaded.load(), {
    welcomeDismissed: true,
    selectedMainRoute: "home",
  });
});

test("workspace ui state persists the selected main route", async () => {
  const memento = createMemento();
  const uiState = createWorkspaceUiState({ memento });

  await uiState.setSelectedMainRoute("setup");

  assert.deepEqual(uiState.load(), {
    welcomeDismissed: false,
    selectedMainRoute: "setup",
  });

  const reloaded = createWorkspaceUiState({ memento });
  assert.deepEqual(reloaded.load(), {
    welcomeDismissed: false,
    selectedMainRoute: "setup",
  });
});

test("workspace ui state migrates older snapshots without a selected route", () => {
  const memento = createMemento({
    "faro.ui": {
      welcomeDismissed: true,
    },
  });
  const uiState = createWorkspaceUiState({ memento });

  assert.deepEqual(uiState.load(), {
    welcomeDismissed: true,
    selectedMainRoute: "home",
  });
});
