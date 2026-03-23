import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeExtensionHost } from "../../../../src/infra/vscode/bindings/create-vscode-extension-host.ts";
import type { VscodeWebview } from "../../../../src/infra/vscode/vscode-api.ts";

type Disposable = {
  dispose(): void;
};

function createFakeWebview() {
  return {
    html: "",
    options: undefined as Record<string, unknown> | undefined,
    webviewUris: [] as string[],
    onDidReceiveMessage() {
      return {
        dispose() {},
      };
    },
    asWebviewUri(value: { value?: string }) {
      const raw = value.value ?? "";
      this.webviewUris.push(raw);
      return {
        toString() {
          return `webview:${raw}`;
        },
      };
    },
  };
}

function createAccessorBackedWebview(): VscodeWebview & { webviewUris: string[] } {
  let html = "";
  let options: Record<string, unknown> | undefined;
  const webview = {
    html,
    options,
    webviewUris: [] as string[],
    onDidReceiveMessage() {
      return {
        dispose() {},
      };
    },
    asWebviewUri(value: { value?: string }) {
      const raw = value.value ?? "";
      this.webviewUris.push(raw);
      return {
        toString() {
          return `webview:${raw}`;
        },
      };
    },
  } as VscodeWebview & { webviewUris: string[] };

  return Object.defineProperties(webview, {
    html: {
      enumerable: true,
      get() {
        return html;
      },
      set(value: string) {
        html = value;
      },
    },
    options: {
      enumerable: true,
      get() {
        return options;
      },
      set(value: Record<string, unknown> | undefined) {
        options = value;
      },
    },
  }) as VscodeWebview & { webviewUris: string[] };
}

function createFakeVscodeApi() {
  const commandRegistrations: string[] = [];
  const executedCommands: string[] = [];
  const mainRegistrations: Array<{
    id: string;
    provider: {
      resolveWebviewView(view: { webview: VscodeWebview }): void | Promise<void>;
    };
  }> = [];
  const mcpRegistrations: Array<{
    id: string;
    provider: {
      provideMcpServerDefinitions(): unknown[];
    };
  }> = [];
  const disposals: string[] = [];

  return {
    api: {
      commands: {
        registerCommand(id: string) {
          commandRegistrations.push(id);
          return createDisposable(`command:${id}`);
        },
        async executeCommand(id: string) {
          executedCommands.push(id);
        },
      },
      window: {
        registerWebviewViewProvider(
          id: string,
          provider: {
            resolveWebviewView(view: { webview: VscodeWebview }): void | Promise<void>;
          },
        ) {
          mainRegistrations.push({ id, provider });
          return createDisposable(`navigator:${id}`);
        },
      },
      workspace: {
        fs: {
          async stat() {
            return {};
          },
        },
        async openTextDocument() {
          return {};
        },
        getConfiguration() {
          return {
            get<T>(_key: string, defaultValue: T): T {
              return defaultValue;
            },
          };
        },
      },
      lm: {
        registerMcpServerDefinitionProvider(
          id: string,
          provider: {
            provideMcpServerDefinitions(): unknown[];
          },
        ) {
          mcpRegistrations.push({ id, provider });
          return createDisposable(`mcp:${id}`);
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
      Position: class Position {},
      Range: class Range {},
      Selection: class Selection {},
      TextEditorRevealType: {
        InCenterIfOutsideViewport: "center",
      },
    },
    commandRegistrations,
    executedCommands,
    mainRegistrations,
    mcpRegistrations,
    disposals,
  };

  function createDisposable(label: string): Disposable {
    return {
      dispose() {
        disposals.push(label);
      },
    };
  }
}

test("createVscodeExtensionHost delegates command and provider registrations", async () => {
  const vscode = createFakeVscodeApi();
  const host = createVscodeExtensionHost({ vscode: vscode.api as never });
  let mainResolved = 0;
  const webview = createFakeWebview();

  const command = host.registerCommand("faro.nextBeacon", () => {});
  const main = host.registerMainProvider("faro.main", {
    refresh() {},
    dispose() {},
    resolveWebviewView(view: { webview: ReturnType<typeof createFakeWebview> }) {
      mainResolved += 1;
      assert.equal(view.webview.html, webview.html);
      assert.equal(view.webview.options?.enableScripts, true);
    },
  });
  const mcp = host.registerMcpServerDefinitionProvider("faro.local", {
    provideMcpServerDefinitions() {
      return [
        {
          label: "Faro",
          command: process.execPath,
          args: ["server.ts"],
          env: {
            FARO_MCP_PORT: 1234,
          },
        },
      ];
    },
  });

  assert.deepEqual(vscode.commandRegistrations, ["faro.nextBeacon"]);
  assert.equal(vscode.mainRegistrations.length, 1);
  assert.equal(webview.options, undefined);

  await vscode.mainRegistrations[0]?.provider.resolveWebviewView({ webview });

  assert.equal(mainResolved, 1);
  assert.equal((webview.options as Record<string, unknown> | undefined)?.enableScripts, true);

  await host.focusFaroView();
  assert.deepEqual(vscode.executedCommands, ["workbench.view.extension.faro"]);
  assert.equal(vscode.mcpRegistrations.length, 1);
  assert.equal(vscode.mcpRegistrations[0]?.id, "faro.local");
  assert.equal(
    (
      vscode.mcpRegistrations[0]?.provider.provideMcpServerDefinitions()[0] as { label: string }
    ).label,
    "Faro",
  );

  mcp.dispose();
  main.dispose();
  command.dispose();

  assert.deepEqual(vscode.disposals, [
    "mcp:faro.local",
    "navigator:faro.main",
    "command:faro.nextBeacon",
  ]);
});

test("createVscodeExtensionHost adapts webview asset helpers for providers", async () => {
  const vscode = createFakeVscodeApi();
  const host = createVscodeExtensionHost({ vscode: vscode.api as never });
  const webview = createFakeWebview();
  let resolvedAssetUri = "";
  let localResourceRoots: unknown[] | undefined;

  host.registerMainProvider("faro.main", {
    refresh() {},
    dispose() {},
    resolveWebviewView(view: {
      webview: ReturnType<typeof createFakeWebview> & {
        resolveWebviewUri(path: string): string;
        setLocalResourceRoots(paths: string[]): void;
      };
    }) {
      resolvedAssetUri = view.webview.resolveWebviewUri(
        "/workspace/faro/dist/webviews/main/index.js",
      );
      view.webview.setLocalResourceRoots(["/workspace/faro/dist/webviews/main"]);
      localResourceRoots = view.webview.options?.localResourceRoots as unknown[] | undefined;
    },
  });

  await vscode.mainRegistrations[0]?.provider.resolveWebviewView({ webview });

  assert.equal(
    resolvedAssetUri,
    "webview:file:///workspace/faro/dist/webviews/main/index.js",
  );
  assert.deepEqual(webview.webviewUris, ["file:///workspace/faro/dist/webviews/main/index.js"]);
  assert.deepEqual(localResourceRoots, [{ value: "file:///workspace/faro/dist/webviews/main" }]);
});

test("createVscodeExtensionHost forwards html writes to accessor-backed webviews", async () => {
  const vscode = createFakeVscodeApi();
  const host = createVscodeExtensionHost({ vscode: vscode.api as never });
  const webview = createAccessorBackedWebview();

  host.registerMainProvider("faro.main", {
    refresh() {},
    dispose() {},
    resolveWebviewView(view) {
      view.webview.html = "<main>Rendered</main>";
    },
  });

  await vscode.mainRegistrations[0]?.provider.resolveWebviewView({ webview });

  assert.equal(webview.html, "<main>Rendered</main>");
});
