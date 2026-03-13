import type { VscodeLike, VscodeWebviewView } from "../vscode-api.ts";
import type {
  ExtensionHost,
  NavigatorProviderLike,
  OutlineProviderLike,
} from "./create-extension-bindings.ts";

export function createVscodeExtensionHost({
  vscode,
}: {
  vscode: VscodeLike;
}): ExtensionHost {
  return {
    registerCommand(id, handler) {
      return vscode.commands.registerCommand(id, handler);
    },
    registerOutlineProvider(id, provider) {
      return vscode.window.registerTreeDataProvider(id, provider as OutlineProviderLike);
    },
    registerNavigatorProvider(id, provider) {
      return vscode.window.registerWebviewViewProvider(id, {
        resolveWebviewView(view: VscodeWebviewView) {
          view.webview.options = {
            ...(view.webview.options ?? {}),
            enableScripts: true,
          };

          return provider.resolveWebviewView(view);
        },
      });
    },
    async focusFaroView() {
      await vscode.commands.executeCommand("workbench.view.extension.faro");
    },
  };
}

export type { NavigatorProviderLike, OutlineProviderLike };
