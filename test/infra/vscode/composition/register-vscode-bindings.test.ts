import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../../../src/core/services/in-memory-store.ts";
import { createFaroMcpResources } from "../../../../src/infra/mcp/create-faro-mcp-resources.ts";
import { createFaroMcpTools } from "../../../../src/infra/mcp/create-faro-mcp-tools.ts";
import {
  registerVscodeBindings as createExtensionBindings,
  type ExtensionHost,
  type WebviewProviderLike,
} from "../../../../src/infra/vscode/composition/register-vscode-bindings.ts";
import { createExtensionRuntime } from "../../../../src/infra/vscode/create-extension-runtime.ts";
import type { ExtensionRuntime } from "../../../../src/infra/vscode/create-extension-runtime.ts";

type Disposable = {
  dispose(): void;
};

function createRuntimeStub() {
  const calls: string[] = [];
  let refreshListener: (() => void) | null = null;
  let unsubscribed = false;
  let disposed = false;
  const store = createInMemoryStore();
  const agent = createFaroAgentService({ store });
  const unsubscribeStore = store.subscribe(() => {
    refreshListener?.();
  });

  const runtime = {
    status: "ready",
    store,
    uiState: {
      load() {
        return {
          welcomeDismissed: false,
          selectedMainRoute: "home" as const,
        };
      },
      async dismissWelcome() {},
      async setSelectedMainRoute() {},
    },
    agent,
    mcp: {
      tools: createFaroMcpTools({ service: agent }),
      resources: createFaroMcpResources({ service: agent }),
    },
    commands: {
      nextBeacon: async () => {
        calls.push("next");
        return { status: "idle" as const };
      },
      previousBeacon: async () => {
        calls.push("previous");
        return { status: "idle" as const };
      },
      setActivePath: async (pathId: string) => {
        calls.push(`setActivePath:${pathId}`);
        return { status: "idle" as const };
      },
      setCurrentBeacon: async (pathId: string, beaconId: string) => {
        calls.push(`setCurrentBeacon:${pathId}:${beaconId}`);
        return { status: "idle" as const };
      },
      revealCurrentBeacon: async () => {
        calls.push("reveal");
        return { status: "idle" as const };
      },
    },
    subscribeToRefresh(listener: () => void) {
      refreshListener = listener;

      return () => {
        unsubscribed = true;
        refreshListener = null;
      };
    },
    refresh() {
      refreshListener?.();
    },
    dispose() {
      unsubscribeStore();
      disposed = true;
    },
  } satisfies ExtensionRuntime;

  return {
    runtime,
    calls,
    emitRefresh() {
      refreshListener?.();
    },
    get unsubscribed() {
      return unsubscribed;
    },
    get disposed() {
      return disposed;
    },
  };
}

function createHostStub() {
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  const mainProviders: Array<{ id: string; provider: WebviewProviderLike }> = [];
  const mcpProviders: Array<{
    id: string;
    provider: {
      provideMcpServerDefinitions(): Array<{
        label: string;
        command: string;
        args: string[];
        env: Record<string, string | number | null>;
      }>;
    };
  }> = [];
  const disposals: string[] = [];
  let focusCalls = 0;
  const focusedViews: string[] = [];
  const contextValues = new Map<string, unknown>();

  const host: ExtensionHost = {
    registerCommand(id, handler) {
      commands.set(id, handler);
      return createDisposable(`command:${id}`);
    },
    registerMainProvider(id, provider) {
      mainProviders.push({ id, provider });
      return createDisposable(`main:${id}`);
    },
    registerMcpServerDefinitionProvider(id, provider) {
      mcpProviders.push({ id, provider });
      return createDisposable(`mcp:${id}`);
    },
    async focusFaroView() {
      focusCalls += 1;
    },
    async focusView(viewId) {
      focusedViews.push(viewId);
    },
    async setContext(key, value) {
      contextValues.set(key, value);
    },
  };

  return {
    host,
    commands,
    mainProviders,
    mcpProviders,
    disposals,
    get focusCalls() {
      return focusCalls;
    },
    focusedViews,
    contextValues,
  };

  function createDisposable(label: string): Disposable {
    return {
      dispose() {
        disposals.push(label);
      },
    };
  }
}

test("bindings register runtime commands and delegate handlers", async () => {
  const runtimeState = createRuntimeStub();
  const hostState = createHostStub();
  const binding = await createExtensionBindings({
    runtime: runtimeState.runtime,
    host: hostState.host,
    extensionPath: "/workspace/faro",
    workspaceRoot: "/workspace/faro",
    registerMcpServer: async ({ host }) =>
      host.registerMcpServerDefinitionProvider("faro.local", {
        provideMcpServerDefinitions() {
          return [
            {
              label: "Faro",
              command: process.execPath,
              args: ["server.ts"],
              env: {},
            },
          ];
        },
      }),
    createProviders: () => ({
      home: {
        refresh() {},
        resolveWebviewView() {},
        dispose() {},
      },
      path: {
        refresh() {},
        resolveWebviewView() {},
        dispose() {},
      },
      setup: {
        refresh() {},
        resolveWebviewView() {},
        dispose() {},
      },
    }),
  });

  await hostState.commands.get("faro.nextBeacon")?.();
  await hostState.commands.get("faro.previousBeacon")?.();
  await hostState.commands.get("faro.revealCurrentBeacon")?.();
  await hostState.commands.get("faro.setActivePath")?.("billing-flow");
  await hostState.commands.get("faro.setCurrentBeacon")?.("billing-flow", "b10");
  await hostState.commands.get("faro.showPath")?.();
  await hostState.commands.get("faro.focusSidebar")?.();

  assert.deepEqual(runtimeState.calls, [
    "next",
    "previous",
    "reveal",
    "setActivePath:billing-flow",
    "setCurrentBeacon:billing-flow:b10",
  ]);
  assert.deepEqual(hostState.focusedViews, ["faro.path"]);
  assert.equal(hostState.contextValues.get("faro.activeView"), "path");
  assert.equal(hostState.focusCalls, 1);

  binding.dispose();
});

test("bindings register the Faro views and MCP provider and fan out refresh", async () => {
  const runtimeState = createRuntimeStub();
  const hostState = createHostStub();
  let homeRefreshes = 0;
  let pathRefreshes = 0;
  let setupRefreshes = 0;
  let homeDisposed = 0;
  let pathDisposed = 0;
  let setupDisposed = 0;

  const binding = await createExtensionBindings({
    runtime: runtimeState.runtime,
    host: hostState.host,
    extensionPath: "/workspace/faro",
    workspaceRoot: "/workspace/faro",
    registerMcpServer: async ({ host }) =>
      host.registerMcpServerDefinitionProvider("faro.local", {
        provideMcpServerDefinitions() {
          return [
            {
              label: "Faro",
              command: process.execPath,
              args: ["server.ts"],
              env: {},
            },
          ];
        },
      }),
    createProviders: () => ({
      home: {
        refresh() {
          homeRefreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {
          homeDisposed += 1;
        },
      },
      path: {
        refresh() {
          pathRefreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {
          pathDisposed += 1;
        },
      },
      setup: {
        refresh() {
          setupRefreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {
          setupDisposed += 1;
        },
      },
    }),
  });

  assert.equal(hostState.mainProviders.length, 3);
  assert.deepEqual(hostState.mainProviders.map(({ id }) => id), [
    "faro.home",
    "faro.path",
    "faro.setup",
  ]);
  assert.equal(hostState.mcpProviders.length, 1);
  assert.equal(hostState.mcpProviders[0]?.id, "faro.local");
  assert.equal(hostState.contextValues.get("faro.activeView"), "home");

  runtimeState.emitRefresh();

  assert.ok(homeRefreshes >= 1);
  assert.ok(pathRefreshes >= 1);
  assert.ok(setupRefreshes >= 1);

  binding.dispose();

  assert.equal(homeDisposed, 1);
  assert.equal(pathDisposed, 1);
  assert.equal(setupDisposed, 1);
  assert.equal(runtimeState.unsubscribed, true);
  assert.equal(hostState.disposals.includes("mcp:faro.local"), true);
  assert.equal(hostState.disposals.includes("main:faro.home"), true);
  assert.equal(hostState.disposals.includes("main:faro.path"), true);
  assert.equal(hostState.disposals.includes("main:faro.setup"), true);
});

test("bindings refresh the Faro views after MCP-driven store changes", async () => {
  const runtime = createExtensionRuntime();
  const hostState = createHostStub();
  let refreshes = 0;

  const binding = await createExtensionBindings({
    runtime,
    host: hostState.host,
    extensionPath: "/workspace/faro",
    workspaceRoot: "/workspace/faro",
    registerMcpServer: async ({ host }) =>
      host.registerMcpServerDefinitionProvider("faro.local", {
        provideMcpServerDefinitions() {
          return [
            {
              label: "Faro",
              command: process.execPath,
              args: ["server.ts"],
              env: {},
            },
          ];
        },
      }),
    createProviders: () => ({
      home: {
        refresh() {
          refreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {},
      },
      path: {
        refresh() {
          refreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {},
      },
      setup: {
        refresh() {
          refreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {},
      },
    }),
  });

  runtime.mcp.tools["faro.upsertPath"].execute({
    path: {
      id: "billing-flow",
      title: "Billing Flow",
      goal: "Trace billing",
      mainPath: ["b10"],
      branches: [],
      current: {
        mode: "main",
        index: 0,
        beaconId: "b10",
      },
      beacons: {
        b10: {
          id: "b10",
          title: "Billing entry",
          fileUri: "file:///workspace/billing.ts",
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 2,
            endColumn: 1,
          },
          summary: "Billing entry",
          explanation: "Billing entry point",
          tags: [],
          children: [],
        },
      },
    },
  });

  assert.equal(refreshes, 3);

  binding.dispose();
  runtime.dispose();
});
