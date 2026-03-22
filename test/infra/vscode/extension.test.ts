import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../../src/core/services/in-memory-store.ts";
import { createFaroMcpResources } from "../../../src/infra/mcp/create-faro-mcp-resources.ts";
import { createFaroMcpTools } from "../../../src/infra/mcp/create-faro-mcp-tools.ts";
import { activate, deactivate } from "../../../src/infra/vscode/extension.ts";
import type {
  CreateExtensionRuntimeOptions,
  ExtensionRuntime,
} from "../../../src/infra/vscode/create-extension-runtime.ts";
import { registerVscodeBindings as createExtensionBindings } from "../../../src/infra/vscode/composition/register-vscode-bindings.ts";
import * as fixtures from "../../core/fixtures.ts";

type Disposable = {
  dispose(): void;
};

function createRuntimeStub(): ExtensionRuntime {
  const store = createInMemoryStore(fixtures.createDocument());
  const agent = createFaroAgentService({ store });

  return {
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
}

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

async function createBindingsWithoutSocket(options: Parameters<typeof createExtensionBindings>[0]) {
  return createExtensionBindings({
    ...options,
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
  });
}

function createHost({ autoFocusOnStartup = false }: { autoFocusOnStartup?: boolean } = {}) {
  const operations: unknown[] = [];
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  const views = new Map<string, unknown>();
  const mcpProviders = new Map<string, unknown>();
  const decorationType = {
    dispose() {
      operations.push(["dispose-decoration"]);
    },
  };

  return {
    operations,
    commands,
    views,
    mcpProviders,
    host: {
      commands: {
        registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
          commands.set(id, handler);
          return {
            dispose() {
              commands.delete(id);
            },
          };
        },
        async executeCommand(id: string) {
          operations.push(["execute-command", id]);
        },
      },
      window: {
        registerTreeDataProvider(id: string, provider: unknown): Disposable {
          views.set(id, provider);
          return {
            dispose() {
              views.delete(id);
            },
          };
        },
        registerWebviewViewProvider(id: string, provider: unknown): Disposable {
          views.set(id, provider);
          return {
            dispose() {
              views.delete(id);
            },
          };
        },
        async showTextDocument(document: { uri: { value: string } }) {
          operations.push(["show-editor", document.uri.value]);
          return {
            revealRange(range: unknown, revealType: unknown) {
              operations.push(["reveal-range", document.uri.value, range, revealType]);
            },
            setDecorations(type: unknown, ranges: unknown[]) {
              operations.push(["set-decorations", document.uri.value, type, ranges]);
            },
            setSelection(selection: unknown) {
              operations.push(["set-selection", document.uri.value, selection]);
            },
          };
        },
        createTextEditorDecorationType(): Disposable {
          operations.push(["create-decoration"]);
          return decorationType;
        },
      },
      workspace: {
        workspaceFolders: [
          {
            uri: {
              toString() {
                return "file:///Users/pietro.marchini/Projects/OSS/faro";
              },
            },
          },
        ],
        fs: {
          async stat(uri: { value: string }) {
            operations.push(["file-exists", uri.value]);
            return {};
          },
        },
        async openTextDocument(uri: { value: string }) {
          operations.push(["open-document", uri.value]);
          return { uri };
        },
        getConfiguration(section: string) {
          assert.equal(section, "faro");
          return {
            get<T>(key: string, defaultValue: T): T {
              if (key === "autoFocusOnStartup") {
                return autoFocusOnStartup as T;
              }

              return defaultValue;
            },
          };
        },
      },
      lm: {
        registerMcpServerDefinitionProvider(id: string, provider: unknown): Disposable {
          mcpProviders.set(id, provider);
          return {
            dispose() {
              mcpProviders.delete(id);
            },
          };
        },
      },
      McpStdioServerDefinition: class McpStdioServerDefinition {
        label: string;
        command: string;
        args: string[];
        env: Record<string, string | number | null>;

        constructor(
          label: string,
          command: string,
          args: string[] = [],
          env: Record<string, string | number | null> = {},
        ) {
          this.label = label;
          this.command = command;
          this.args = args;
          this.env = env;
        }
      },
      Uri: {
        parse(value: string) {
          return { value };
        },
      },
      Position: class Position {
        line: number;
        character: number;

        constructor(line: number, character: number) {
          this.line = line;
          this.character = character;
        }
      },
      Range: class Range {
        start: { line: number; character: number };
        end: { line: number; character: number };

        constructor(
          start: { line: number; character: number },
          end: { line: number; character: number },
        ) {
          this.start = start;
          this.end = end;
        }
      },
      Selection: class Selection {
        anchor: { line: number; character: number };
        active: { line: number; character: number };

        constructor(
          anchor: { line: number; character: number },
          active: { line: number; character: number },
        ) {
          this.anchor = anchor;
          this.active = active;
        }
      },
      TextEditorRevealType: {
        InCenterIfOutsideViewport: "center",
      },
    },
  };
}

test("activate registers the full faro UI surface through the injected host", async () => {
  const subscriptions: Disposable[] = [];
  const workspaceState = createWorkspaceState();
  const { host, commands, views, operations, mcpProviders } = createHost({
    autoFocusOnStartup: true,
  });

  const runtime = await activate(
    { subscriptions, workspaceState, extensionPath: "/workspace/faro" },
    {
      runtimeFactory: createRuntimeStub,
      bindingsFactory: createBindingsWithoutSocket,
      loadVscodeApi: async () => host as never,
    },
  );

  assert.equal(runtime.status, "ready");
  assert.equal(subscriptions.length, 2);
  assert.deepEqual([...commands.keys()].sort(), [
    "faro.focusSidebar",
    "faro.nextBeacon",
    "faro.previousBeacon",
    "faro.revealCurrentBeacon",
    "faro.setActivePath",
    "faro.setCurrentBeacon",
  ]);
  assert.deepEqual([...views.keys()], ["faro.main"]);
  assert.deepEqual([...mcpProviders.keys()], ["faro.local"]);
  assert.match(JSON.stringify(operations), /workbench\.view\.extension\.faro/);

  deactivate();
});

test("activate does not focus the faro sidebar when startup autofocusing is disabled", async () => {
  const subscriptions: Disposable[] = [];
  const workspaceState = createWorkspaceState();
  const { host, operations } = createHost();

  await activate(
    { subscriptions, workspaceState, extensionPath: "/workspace/faro" },
    {
      runtimeFactory: createRuntimeStub,
      bindingsFactory: createBindingsWithoutSocket,
      loadVscodeApi: async () => host as never,
    },
  );

  assert.doesNotMatch(JSON.stringify(operations), /workbench\.view\.extension\.faro/);

  deactivate();
});

test("activate passes workspace state and editor-backed reveal to the runtime factory", async () => {
  const subscriptions: Disposable[] = [];
  const workspaceState = createWorkspaceState();
  const { host, operations, commands } = createHost();
  let receivedOptions: unknown;

  await activate(
    { subscriptions, workspaceState, extensionPath: "/workspace/faro" },
    {
      runtimeFactory: (options?: CreateExtensionRuntimeOptions): ExtensionRuntime => {
        receivedOptions = options;
        const runtime = createRuntimeStub();

        return {
          ...runtime,
          commands: {
            nextBeacon: async () => ({ status: "idle" }),
            previousBeacon: async () => ({ status: "idle" }),
            setActivePath: async () => ({ status: "idle" }),
            setCurrentBeacon: async () => ({ status: "idle" }),
            revealCurrentBeacon: async () => {
              await options?.revealBeacon?.(
                fixtures.createBeacon("b1", {
                  fileUri: "file:///workspace/auth.ts",
                }),
              );
              return { status: "idle" };
            },
          },
          subscribeToRefresh() {
            return () => {};
          },
          refresh() {},
          dispose() {},
        };
      },
      bindingsFactory: createBindingsWithoutSocket,
      loadVscodeApi: async () => host as never,
    },
  );

  const runtimeOptions = receivedOptions as {
    workspaceState: unknown;
    initialDocument?: {
      schemaVersion: number;
      activePathId: string | null;
      paths: unknown[];
    };
    revealBeacon?(beacon: ReturnType<typeof fixtures.createBeacon>): Promise<unknown>;
  };

  assert.equal(runtimeOptions.workspaceState, workspaceState);
  assert.equal(typeof runtimeOptions.revealBeacon, "function");
  assert.deepEqual(runtimeOptions.initialDocument, {
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });

  await commands.get("faro.revealCurrentBeacon")?.();
  deactivate();

  assert.match(JSON.stringify(operations), /open-document/);
});
