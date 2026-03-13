import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeExtensionHost } from "../../src/infra/vscode/bindings/create-vscode-extension-host.ts";

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
  const outlineRegistrations: string[] = [];
  const navigatorRegistrations: Array<{
    id: string;
    provider: {
      resolveWebviewView(view: { webview: ReturnType<typeof createFakeWebview> }): void | Promise<void>;
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
        registerTreeDataProvider(id: string) {
          outlineRegistrations.push(id);
          return createDisposable(`outline:${id}`);
        },
        registerWebviewViewProvider(
          id: string,
          provider: {
            resolveWebviewView(view: { webview: ReturnType<typeof createFakeWebview> }): void | Promise<void>;
          },
        ) {
          navigatorRegistrations.push({ id, provider });
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
    outlineRegistrations,
    navigatorRegistrations,
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
  let navigatorResolved = 0;
  const webview = createFakeWebview();
  const outlineProvider = {
    refresh() {},
    dispose() {},
    getChildren() {
      return [];
    },
    getTreeItem() {
      return {};
    },
    onDidChangeTreeData() {
      return {
        dispose() {},
      };
    },
  };

  const command = host.registerCommand("faro.nextBeacon", () => {});
  const outline = host.registerOutlineProvider(
    "faro.outline",
    outlineProvider as never,
  );
  const navigator = host.registerNavigatorProvider("faro.navigator", {
    refresh() {},
    dispose() {},
    resolveWebviewView(view: { webview: ReturnType<typeof createFakeWebview> }) {
      navigatorResolved += 1;
      assert.equal(view.webview, webview);
    },
  });

  assert.deepEqual(vscode.commandRegistrations, ["faro.nextBeacon"]);
  assert.deepEqual(vscode.outlineRegistrations, ["faro.outline"]);
  assert.equal(vscode.navigatorRegistrations.length, 1);
  assert.equal(webview.options, undefined);

  await vscode.navigatorRegistrations[0]?.provider.resolveWebviewView({ webview });

  assert.equal(navigatorResolved, 1);
  assert.equal((webview.options as Record<string, unknown> | undefined)?.enableScripts, true);

  await host.focusFaroView();
  assert.deepEqual(vscode.executedCommands, ["workbench.view.extension.faro"]);

  navigator.dispose();
  outline.dispose();
  command.dispose();

  assert.deepEqual(vscode.disposals, [
    "navigator:faro.navigator",
    "outline:faro.outline",
    "command:faro.nextBeacon",
  ]);
});
