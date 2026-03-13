import { createNavigatorWebviewViewProvider } from "../navigator-webview-view-provider.ts";
import { createOutlineTreeProvider } from "../outline-tree-provider.ts";
import type { ExtensionRuntime } from "../create-extension-runtime.ts";
import { registerRuntimeCommands } from "../register-runtime-commands.ts";
import type { VscodeWebviewView } from "../vscode-api.ts";

type Disposable = {
  dispose(): void;
};

type CommandHandler = (...args: unknown[]) => unknown;

export type OutlineProviderLike = Disposable & {
  refresh(): void;
};

export type NavigatorProviderLike = Disposable & {
  refresh(): void;
  resolveWebviewView(view: VscodeWebviewView): void;
};

export type ExtensionHost = {
  registerCommand(id: string, handler: CommandHandler): Disposable;
  registerOutlineProvider(id: string, provider: OutlineProviderLike): Disposable;
  registerNavigatorProvider(id: string, provider: NavigatorProviderLike): Disposable;
  focusFaroView(): void | Promise<void>;
};

type Dependencies = {
  runtime: ExtensionRuntime;
  host: ExtensionHost;
  createOutlineProvider?(runtime: ExtensionRuntime): OutlineProviderLike;
  createNavigatorProvider?(runtime: ExtensionRuntime): NavigatorProviderLike;
};

export function createExtensionBindings({
  runtime,
  host,
  createOutlineProvider = defaultCreateOutlineProvider,
  createNavigatorProvider = defaultCreateNavigatorProvider,
}: Dependencies): Disposable {
  const outlineProvider = createOutlineProvider(runtime);
  const navigatorProvider = createNavigatorProvider(runtime);
  const refreshUnsubscribe = runtime.subscribeToRefresh(() => {
    outlineProvider.refresh();
    navigatorProvider.refresh();
  });
  const commandRegistration = registerRuntimeCommands({
    commands: {
      registerCommand(id, handler) {
        return host.registerCommand(id, handler);
      },
    },
    runtimeCommands: runtime.commands,
  });

  const registrations: Disposable[] = [
    commandRegistration,
    host.registerCommand("faro.focusSidebar", () => host.focusFaroView()),
    host.registerOutlineProvider("faro.outline", outlineProvider),
    host.registerNavigatorProvider("faro.navigator", navigatorProvider),
  ];

  return {
    dispose() {
      refreshUnsubscribe();
      navigatorProvider.dispose();
      outlineProvider.dispose();

      for (const registration of registrations.reverse()) {
        registration.dispose();
      }
    },
  };
}

function defaultCreateOutlineProvider(runtime: ExtensionRuntime): OutlineProviderLike {
  return createOutlineTreeProvider({ store: runtime.store });
}

function defaultCreateNavigatorProvider(runtime: ExtensionRuntime): NavigatorProviderLike {
  return createNavigatorWebviewViewProvider({
    store: runtime.store,
    commands: runtime.commands,
  });
}
