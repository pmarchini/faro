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

export type MainProviderLike = Disposable & {
  refresh(): void;
  resolveWebviewView(view: VscodeWebviewView): void;
};

export type ExtensionHost = {
  registerCommand(id: string, handler: CommandHandler): Disposable;
  registerMainProvider(id: string, provider: MainProviderLike): Disposable;
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
  createMainProvider?(options: {
    runtime: ExtensionRuntime;
    extensionPath: string;
    workspaceRoot: string;
  }): MainProviderLike;
};

export async function registerVscodeBindings({
  runtime,
  host,
  extensionPath,
  workspaceRoot,
  registerMcpServer = registerRuntimeMcpServer,
  createMainProvider = defaultCreateMainProvider,
}: Dependencies): Promise<Disposable> {
  const mainProvider = createMainProvider({
    runtime,
    extensionPath,
    workspaceRoot,
  });
  const refreshUnsubscribe = runtime.subscribeToRefresh(() => {
    mainProvider.refresh();
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

  const registrations: Disposable[] = [
    mcpServerRegistration,
    commandRegistration,
    host.registerCommand("faro.focusSidebar", () => host.focusFaroView()),
    host.registerMainProvider("faro.main", mainProvider),
  ];

  return {
    dispose() {
      refreshUnsubscribe();
      mainProvider.dispose();

      for (const registration of registrations.reverse()) {
        registration.dispose();
      }
    },
  };
}

function defaultCreateMainProvider({
  runtime,
  extensionPath,
  workspaceRoot,
}: {
  runtime: ExtensionRuntime;
  extensionPath: string;
  workspaceRoot: string;
}): MainProviderLike {
  return createMainWebviewViewProvider({
    store: runtime.store,
    uiState: runtime.uiState,
    commands: runtime.commands,
    setupService: createSetupIntegrationService({
      workspaceRoot,
      extensionRoot: extensionPath,
    }),
  });
}
