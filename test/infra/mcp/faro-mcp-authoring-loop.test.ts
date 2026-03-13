import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";

import { createBeacon, createPath } from "../../core/fixtures.ts";
import {
  createExtensionBindings,
  type ExtensionHost,
  type NavigatorProviderLike,
  type OutlineProviderLike,
} from "../../../src/infra/vscode/bindings/create-extension-bindings.ts";
import { createExtensionRuntime } from "../../../src/infra/vscode/create-extension-runtime.ts";
import { registerRuntimeMcpServer } from "../../../src/infra/vscode/bindings/register-runtime-mcp-server.ts";

type Disposable = {
  dispose(): void | Promise<void>;
};

type McpServerDefinition = {
  label: string;
  command: string;
  args: string[];
  env: Record<string, string | number | null>;
};

type JsonRpcSuccessResponse = {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
};

type JsonRpcErrorResponse = {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
};

type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

test("registered stdio MCP authoring updates the runtime-backed outline and navigator views", async () => {
  const extensionPath = fileURLToPath(new URL("../../../", import.meta.url));
  const runtime = createExtensionRuntime();
  const state: {
    mcpRegistration: Disposable | null;
  } = {
    mcpRegistration: null,
  };
  const hostState = createHostState();
  const bindings = await createExtensionBindings({
    runtime,
    host: hostState.host,
    extensionPath,
    registerMcpServer: async (options) => {
      state.mcpRegistration = await registerRuntimeMcpServer(options);

      return {
        dispose() {},
      };
    },
  });
  const outlineProvider = hostState.outlineProviders[0]?.provider;
  const navigatorProvider = hostState.navigatorProviders[0]?.provider;
  const definition = hostState.mcpProviders[0]?.provider.provideMcpServerDefinitions()[0];

  assert.ok(outlineProvider);
  assert.ok(navigatorProvider);
  assert.ok(definition);

  let outlineRefreshes = 0;
  const outlineSubscription = outlineProvider.onDidChangeTreeData(() => {
    outlineRefreshes += 1;
  });
  const navigatorView = createNavigatorView();
  navigatorProvider.resolveWebviewView(navigatorView);
  const initialNavigatorHtml = navigatorView.webview.html;
  const client = await startStdioMcpClient(definition);

  try {
    const initialize = await client.request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
      },
    });
    assert.ok("result" in initialize);

    client.notify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    const replacementPath = createPath({
      id: "sample-flow",
      title: "Authentication Story",
      goal: "Build the auth request mental model in three stable steps",
      mainPath: ["entry", "decision", "session"],
      current: {
        mode: "main",
        index: 0,
        beaconId: "entry",
      },
      beacons: {
        entry: createBeacon("entry", {
          title: "Normalize request context",
          summary: "Headers and request metadata are made consistent.",
          explanation: "This is the first stable anchor because every later auth step depends on the normalized context.",
          tags: ["entrypoint", "normalization"],
        }),
        decision: createBeacon("decision", {
          title: "Choose the auth path",
          summary: "The request is classified into the relevant auth branch.",
          explanation: "This decision is the main branching concept a reader needs before details start to fan out.",
          tags: ["decision", "branch"],
        }),
        session: createBeacon("session", {
          title: "Persist the authenticated session",
          summary: "The verified identity becomes session state.",
          explanation: "This closes the main path with the user-visible state transition the developer will care about.",
          tags: ["state", "side-effect"],
        }),
      },
    });

    const upsert = await client.request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "faro.upsertPath",
        arguments: {
          path: replacementPath,
        },
      },
    });
    assert.ok("result" in upsert);
    assert.equal(
      (
        upsert.result as {
          structuredContent: {
            ok: boolean;
            value?: {
              path?: {
                id: string;
              };
            };
          };
        }
      ).structuredContent.value?.path?.id,
      "sample-flow",
    );

    const readPath = await client.request({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: {
        uri: "faro://paths/sample-flow",
      },
    });
    assert.ok("result" in readPath);
    assert.match(
      (
        readPath.result as {
          contents: Array<{ text?: string }>;
        }
      ).contents[0]?.text ?? "",
      /Authentication Story/,
    );

    assert.ok(outlineRefreshes > 0);
    const pathItems = outlineProvider.getChildren();
    const pathTreeItem = outlineProvider.getTreeItem(pathItems[0]);
    assert.equal(pathTreeItem.label, "Authentication Story");
    const beaconItems = outlineProvider.getChildren(pathItems[0]);
    const beaconTreeItem = outlineProvider.getTreeItem(beaconItems[0]);
    assert.equal(beaconTreeItem.label, "Normalize request context");
    assert.equal(beaconTreeItem.contextValue, "current-beacon");

    assert.notEqual(navigatorView.webview.html, initialNavigatorHtml);
    assert.match(navigatorView.webview.html, /Authentication Story \/ Normalize request context/);
    assert.match(
      navigatorView.webview.html,
      /This is the first stable anchor because every later auth step depends on the normalized context./,
    );
  } finally {
    await client.dispose();
    outlineSubscription.dispose();
    bindings.dispose();
    if (state.mcpRegistration) {
      await state.mcpRegistration.dispose();
    }
    runtime.dispose();
  }
});

function createNavigatorView() {
  let listener: ((message: { type: string }) => void | Promise<void>) | null = null;

  return {
    webview: {
      html: "",
      onDidReceiveMessage(
        nextListener: (message: { type: string }) => void | Promise<void>,
      ): Disposable {
        listener = nextListener;

        return {
          dispose() {
            if (listener === nextListener) {
              listener = null;
            }
          },
        };
      },
    },
    async postMessage(message: { type: string }) {
      await listener?.(message);
    },
  };
}

async function startStdioMcpClient(definition: McpServerDefinition) {
  const child = spawn(definition.command, definition.args, {
    env: {
      ...process.env,
      ...coerceEnv(definition.env),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stderr: string[] = [];
  const lines = createInterface({
    input: child.stdout,
  });
  const pending = new Map<
    number,
    {
      resolve(response: JsonRpcResponse): void;
      reject(error: Error): void;
      timeout: NodeJS.Timeout;
    }
  >();

  child.stdin.setDefaultEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr.push(chunk);
  });
  lines.on("line", (line) => {
    const response = JSON.parse(line) as JsonRpcResponse;

    if (typeof response.id !== "number") {
      return;
    }

    const pendingRequest = pending.get(response.id);

    if (!pendingRequest) {
      return;
    }

    clearTimeout(pendingRequest.timeout);
    pending.delete(response.id);
    pendingRequest.resolve(response);
  });
  child.on("exit", (code, signal) => {
    const error = new Error(
      `Faro MCP stdio bridge exited before the request completed (code=${code}, signal=${signal}). ${stderr.join("")}`.trim(),
    );

    for (const [id, pendingRequest] of pending) {
      clearTimeout(pendingRequest.timeout);
      pending.delete(id);
      pendingRequest.reject(error);
    }
  });

  return {
    request(message: {
      jsonrpc: "2.0";
      id: number;
      method: string;
      params?: unknown;
    }): Promise<JsonRpcResponse> {
      return new Promise<JsonRpcResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(message.id);
          reject(
            new Error(
              `Timed out waiting for JSON-RPC response ${message.id}. ${stderr.join("")}`.trim(),
            ),
          );
        }, 10_000);

        pending.set(message.id, {
          resolve,
          reject,
          timeout,
        });
        child.stdin.write(`${JSON.stringify(message)}\n`);
      });
    },
    notify(message: {
      jsonrpc: "2.0";
      method: string;
      params?: unknown;
    }): void {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    async dispose(): Promise<void> {
      lines.close();
      child.stdin.end();

      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
      }

      await once(child, "exit").catch(() => undefined);
    },
  };
}

function coerceEnv(
  env: Record<string, string | number | null>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, value === null ? undefined : String(value)]),
  );
}

function createHostState() {
  const outlineProviders: Array<{
    id: string;
    provider: OutlineProviderLike & {
      getChildren(element?: unknown): unknown[];
      getTreeItem(element: unknown): {
        label: string;
        contextValue: string;
      };
      onDidChangeTreeData(listener: () => void): Disposable;
    };
  }> = [];
  const navigatorProviders: Array<{
    id: string;
    provider: NavigatorProviderLike;
  }> = [];
  const mcpProviders: Array<{
    id: string;
    provider: {
      provideMcpServerDefinitions(): McpServerDefinition[];
    };
  }> = [];

  const host: ExtensionHost = {
    registerCommand() {
      return {
        dispose() {},
      };
    },
    registerOutlineProvider(id, provider) {
      outlineProviders.push({
        id,
        provider: outlineProviderWithTreeApi(provider),
      });

      return {
        dispose() {},
      };
    },
    registerNavigatorProvider(id, provider) {
      navigatorProviders.push({ id, provider });

      return {
        dispose() {},
      };
    },
    registerMcpServerDefinitionProvider(id, provider) {
      mcpProviders.push({ id, provider });

      return {
        dispose() {},
      };
    },
    focusFaroView() {},
  };

  return {
    host,
    outlineProviders,
    navigatorProviders,
    mcpProviders,
  };
}

function outlineProviderWithTreeApi(provider: OutlineProviderLike) {
  return provider as OutlineProviderLike & {
    getChildren(element?: unknown): unknown[];
    getTreeItem(element: unknown): {
      label: string;
      contextValue: string;
    };
    onDidChangeTreeData(listener: () => void): Disposable;
  };
}
