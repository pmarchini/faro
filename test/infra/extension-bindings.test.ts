import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { createFaroMcpResources } from "../../src/infra/mcp/create-faro-mcp-resources.ts";
import { createFaroMcpTools } from "../../src/infra/mcp/create-faro-mcp-tools.ts";
import {
  createExtensionBindings,
  type ExtensionHost,
  type NavigatorProviderLike,
  type OutlineProviderLike,
} from "../../src/infra/vscode/bindings/create-extension-bindings.ts";
import type { ExtensionRuntime } from "../../src/infra/vscode/create-extension-runtime.ts";

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

  const runtime = {
    status: "ready",
    store,
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
  const outlineProviders: Array<{ id: string; provider: OutlineProviderLike }> = [];
  const navigatorProviders: Array<{ id: string; provider: NavigatorProviderLike }> = [];
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

  const host: ExtensionHost = {
    registerCommand(id, handler) {
      commands.set(id, handler);
      return createDisposable(`command:${id}`);
    },
    registerOutlineProvider(id, provider) {
      outlineProviders.push({ id, provider });
      return createDisposable(`outline:${id}`);
    },
    registerNavigatorProvider(id, provider) {
      navigatorProviders.push({ id, provider });
      return createDisposable(`navigator:${id}`);
    },
    registerMcpServerDefinitionProvider(id, provider) {
      mcpProviders.push({ id, provider });
      return createDisposable(`mcp:${id}`);
    },
    async focusFaroView() {
      focusCalls += 1;
    },
  };

  return {
    host,
    commands,
    outlineProviders,
    navigatorProviders,
    mcpProviders,
    disposals,
    get focusCalls() {
      return focusCalls;
    },
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
    createOutlineProvider: () =>
      ({
        refresh() {},
        dispose() {},
      }) as OutlineProviderLike,
    createNavigatorProvider: () =>
      ({
        refresh() {},
        resolveWebviewView() {},
        dispose() {},
      }) as NavigatorProviderLike,
  });

  await hostState.commands.get("faro.nextBeacon")?.();
  await hostState.commands.get("faro.previousBeacon")?.();
  await hostState.commands.get("faro.revealCurrentBeacon")?.();
  await hostState.commands.get("faro.setActivePath")?.("billing-flow");
  await hostState.commands.get("faro.setCurrentBeacon")?.("billing-flow", "b10");
  await hostState.commands.get("faro.focusSidebar")?.();

  assert.deepEqual(runtimeState.calls, [
    "next",
    "previous",
    "reveal",
    "setActivePath:billing-flow",
    "setCurrentBeacon:billing-flow:b10",
  ]);
  assert.equal(hostState.focusCalls, 1);

  binding.dispose();
});

test("bindings register outline, navigator, and MCP providers and fan out refresh", async () => {
  const runtimeState = createRuntimeStub();
  const hostState = createHostStub();
  let outlineRefreshes = 0;
  let navigatorRefreshes = 0;
  let outlineDisposed = 0;
  let navigatorDisposed = 0;

  const binding = await createExtensionBindings({
    runtime: runtimeState.runtime,
    host: hostState.host,
    extensionPath: "/workspace/faro",
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
    createOutlineProvider: () =>
      ({
        refresh() {
          outlineRefreshes += 1;
        },
        dispose() {
          outlineDisposed += 1;
        },
      }) as OutlineProviderLike,
    createNavigatorProvider: () =>
      ({
        refresh() {
          navigatorRefreshes += 1;
        },
        resolveWebviewView() {},
        dispose() {
          navigatorDisposed += 1;
        },
      }) as NavigatorProviderLike,
  });

  assert.equal(hostState.outlineProviders.length, 1);
  assert.deepEqual(hostState.outlineProviders[0], {
    id: "faro.outline",
    provider: hostState.outlineProviders[0]?.provider,
  });
  assert.equal(hostState.navigatorProviders.length, 1);
  assert.deepEqual(hostState.navigatorProviders[0], {
    id: "faro.navigator",
    provider: hostState.navigatorProviders[0]?.provider,
  });
  assert.equal(hostState.mcpProviders.length, 1);
  assert.equal(hostState.mcpProviders[0]?.id, "faro.local");

  runtimeState.emitRefresh();

  assert.equal(outlineRefreshes, 1);
  assert.equal(navigatorRefreshes, 1);

  binding.dispose();

  assert.equal(outlineDisposed, 1);
  assert.equal(navigatorDisposed, 1);
  assert.equal(runtimeState.unsubscribed, true);
  assert.equal(hostState.disposals.includes("mcp:faro.local"), true);
});
