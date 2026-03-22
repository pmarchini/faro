import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeExtensionHost } from "../../../../src/infra/vscode/bindings/create-vscode-extension-host.ts";

type Disposable = {
  dispose(): void;
};

function createFakeWebview() {
  return {
    html: "",
    options: undefined as Record<string, unknown> | undefined,
    onDidReceiveMessage() {
      return {
        dispose() {},
      };
    },
  };
}

function createFakeVscodeApi() {
  const commandRegistrations: string[] = [];
  const executedCommands: string[] = [];
  const mainRegistrations: Array<{
    id: string;
    provider: {
      resolveWebviewView(view: { webview: ReturnType<typeof createFakeWebview> }): void | Promise<void>;
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
            resolveWebviewView(view: { webview: ReturnType<typeof createFakeWebview> }): void | Promise<void>;
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
      assert.equal(view.webview, webview);
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
  await host.focusView("faro.path");
  await host.setContext("faro.activeView", "path");
  assert.deepEqual(vscode.executedCommands, [
    "workbench.view.extension.faro",
    "faro.path.focus",
    "setContext",
  ]);
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
