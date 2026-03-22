import { createMainWebviewViewProvider } from "../ui/main-view/main-view-provider.ts";
import type { ExtensionRuntime } from "../create-extension-runtime.ts";
import { registerRuntimeCommands } from "../register-runtime-commands.ts";
import type { VscodeWebviewView } from "../vscode-api.ts";
import { registerRuntimeMcpServer } from "../bindings/register-runtime-mcp-server.ts";
import { createSetupIntegrationService } from "../../tooling/setup-integration-service.ts";

type Disposable = {
  dispose(): void;
};

type CommandHandler = (...args: unknown[]) => unknown;

export type WebviewProviderLike = Disposable & {
  refresh(): void;
  resolveWebviewView(view: VscodeWebviewView): void;
};

export type MainProviderLike = WebviewProviderLike;

export type ExtensionHost = {
  registerCommand(id: string, handler: CommandHandler): Disposable;
  registerMainProvider(id: string, provider: WebviewProviderLike): Disposable;
  registerMcpServerDefinitionProvider(
    id: string,
    provider: {
      provideMcpServerDefinitions(): Array<{
        label: string;
        command: string;
        args: string[];
        env: Record<string, string | number | null>;
      }>;
    },
  ): Disposable;
  focusFaroView(): void | Promise<void>;
  focusView(viewId: "faro.home" | "faro.path" | "faro.setup"): void | Promise<void>;
  setContext(key: string, value: unknown): void | Promise<void>;
};

type Dependencies = {
  runtime: ExtensionRuntime;
  host: ExtensionHost;
  extensionPath: string;
  workspaceRoot: string;
  registerMcpServer?(options: {
    runtime: ExtensionRuntime;
    host: ExtensionHost;
    extensionPath: string;
  }): Promise<Disposable>;
  createProviders?(options: {
    runtime: ExtensionRuntime;
    host: ExtensionHost;
    extensionPath: string;
    workspaceRoot: string;
  }): {
    home: WebviewProviderLike;
    path: WebviewProviderLike;
    setup: WebviewProviderLike;
  };
};

export async function registerVscodeBindings({
  runtime,
  host,
  extensionPath,
  workspaceRoot,
  registerMcpServer = registerRuntimeMcpServer,
  createProviders = defaultCreateProviders,
}: Dependencies): Promise<Disposable> {
  const providers = createProviders({
    runtime,
    host,
    extensionPath,
    workspaceRoot,
  });
  await host.setContext("faro.activeView", runtime.uiState.load().selectedMainRoute);
  const refreshUnsubscribe = runtime.subscribeToRefresh(() => {
    providers.home.refresh();
    providers.path.refresh();
    providers.setup.refresh();
  });
  const mcpServerRegistration = await registerMcpServer({
    runtime,
    extensionPath,
    host,
  });
  const commandRegistration = registerRuntimeCommands({
    commands: {
      registerCommand(id, handler) {
        return host.registerCommand(id, handler);
      },
    },
    runtimeCommands: runtime.commands,
  });

  async function showRoute(route: "home" | "path" | "setup"): Promise<void> {
    await runtime.uiState.setSelectedMainRoute(route);
    await host.setContext("faro.activeView", route);
    providers.home.refresh();
    providers.path.refresh();
    providers.setup.refresh();
    await host.focusView(`faro.${route}`);
  }

  const registrations: Disposable[] = [
    mcpServerRegistration,
    commandRegistration,
    host.registerCommand("faro.focusSidebar", () => host.focusFaroView()),
    host.registerCommand("faro.showHome", () => showRoute("home")),
    host.registerCommand("faro.showPath", () => showRoute("path")),
    host.registerCommand("faro.showSetup", () => showRoute("setup")),
    host.registerMainProvider("faro.home", providers.home),
    host.registerMainProvider("faro.path", providers.path),
    host.registerMainProvider("faro.setup", providers.setup),
  ];

  return {
    dispose() {
      refreshUnsubscribe();
      providers.home.dispose();
      providers.path.dispose();
      providers.setup.dispose();

      for (const registration of registrations.reverse()) {
        registration.dispose();
      }
    },
  };
}

function defaultCreateProviders({
  runtime,
  host,
  extensionPath,
  workspaceRoot,
}: {
  runtime: ExtensionRuntime;
  host: ExtensionHost;
  extensionPath: string;
  workspaceRoot: string;
}): {
  home: WebviewProviderLike;
  path: WebviewProviderLike;
  setup: WebviewProviderLike;
} {
  const createProvider = (route: "home" | "path" | "setup") =>
    createMainWebviewViewProvider({
      store: runtime.store,
      uiState: runtime.uiState,
      commands: runtime.commands,
      setupService: createSetupIntegrationService({
        workspaceRoot,
        extensionRoot: extensionPath,
      }),
      route,
      focusView: async (viewId) => {
        await host.focusView(viewId);
      },
    });

  return {
    home: createProvider("home"),
    path: createProvider("path"),
    setup: createProvider("setup"),
  };
}
