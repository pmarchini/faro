import assert from "node:assert/strict";
import test from "node:test";

import { activate, deactivate } from "../../src/infra/vscode/extension.ts";
import type { ExtensionRuntime } from "../../src/infra/vscode/create-extension-runtime.ts";
import type { InMemoryStore } from "../../src/core/services/in-memory-store.ts";

function createWorkspaceState() {
  return {
    get() {
      return undefined;
    },
    update() {
      return Promise.resolve();
    },
  };
}

function createStoreStub(): InMemoryStore {
  return {} as InMemoryStore;
}

test("activate registers the runtime in the extension subscriptions", () => {
  const subscriptions: Array<{ dispose(): void }> = [];

  const runtime = activate({ subscriptions });

  assert.equal(runtime.status, "ready");
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0], runtime);

  deactivate();
});

test("activate passes workspace state to the runtime factory", () => {
  const subscriptions: Array<{ dispose(): void }> = [];
  const workspaceState = createWorkspaceState();
  let receivedOptions: unknown;

  const runtime = activate(
    { subscriptions, workspaceState },
    (options): ExtensionRuntime => {
      receivedOptions = options;

      return {
        status: "ready",
        store: createStoreStub(),
        commands: {
          nextBeacon: async () => ({ status: "idle" }),
          previousBeacon: async () => ({ status: "idle" }),
          setActivePath: async () => ({ status: "idle" }),
          setCurrentBeacon: async () => ({ status: "idle" }),
          revealCurrentBeacon: async () => ({ status: "idle" }),
        },
        subscribeToRefresh() {
          return () => {};
        },
        refresh() {},
        dispose() {},
      };
    },
  );

  assert.equal(runtime.status, "ready");
  assert.deepEqual(receivedOptions, { workspaceState });

  deactivate();
});
