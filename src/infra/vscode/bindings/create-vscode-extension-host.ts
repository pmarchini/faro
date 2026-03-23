import { pathToFileURL } from "node:url";

import type { VscodeLike, VscodeWebview, VscodeWebviewView } from "../vscode-api.ts";
import type {
  ExtensionHost,
  MainProviderLike,
} from "../composition/register-vscode-bindings.ts";

export function createVscodeExtensionHost({
  vscode,
}: {
  vscode: VscodeLike;
}): ExtensionHost {
  return {
    registerCommand(id, handler) {
      return vscode.commands.registerCommand(id, handler);
    },
    registerMainProvider(id, provider) {
      return vscode.window.registerWebviewViewProvider(id, {
        resolveWebviewView(view: VscodeWebviewView) {
          view.webview.options = {
            ...(view.webview.options ?? {}),
            enableScripts: true,
          };

          const adaptedWebview: VscodeWebview = {
            get html() {
              return view.webview.html;
            },
            set html(value: string) {
              view.webview.html = value;
            },
            get options(): Record<string, unknown> | undefined {
              return view.webview.options;
            },
            set options(value: Record<string, unknown> | undefined) {
              view.webview.options = value;
            },
            onDidReceiveMessage(listener: Parameters<typeof view.webview.onDidReceiveMessage>[0]) {
              return view.webview.onDidReceiveMessage(listener);
            },
            resolveWebviewUri(path: string) {
              if (!view.webview.asWebviewUri) {
                return pathToFileURL(path).toString();
              }

              return view.webview.asWebviewUri(
                vscode.Uri.parse(pathToFileURL(path).toString()),
              ).toString();
            },
            setLocalResourceRoots(paths: string[]) {
              const localResourceRoots = paths.map((path) =>
                vscode.Uri.parse(pathToFileURL(path).toString())
              );
              const nextOptions = {
                ...(view.webview.options ?? {}),
                localResourceRoots,
              };
              view.webview.options = nextOptions;
            },
          };

          return provider.resolveWebviewView({
            ...view,
            webview: adaptedWebview,
          });
        },
      });
    },
    registerMcpServerDefinitionProvider(id, provider) {
      return vscode.lm.registerMcpServerDefinitionProvider(id, {
        provideMcpServerDefinitions() {
          return provider.provideMcpServerDefinitions().map((definition) => {
            const serverDefinition = new vscode.McpStdioServerDefinition(
              definition.label,
              definition.command,
              definition.args,
              definition.env,
            );

            return serverDefinition;
          });
        },
      });
    },
    async focusFaroView() {
      await vscode.commands.executeCommand("workbench.view.extension.faro");
    },
  };
}

export type { MainProviderLike };
