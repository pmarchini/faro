import {
  createExtensionBindings,
  type ExtensionHost,
} from "./bindings/create-extension-bindings.ts";
import { createVscodeExtensionHost } from "./bindings/create-vscode-extension-host.ts";
import {
  createExtensionRuntime,
  type CreateExtensionRuntimeOptions,
  type ExtensionRuntime,
} from "./create-extension-runtime.ts";
import type { VscodeLike } from "./vscode-api.ts";
import { createSeedDocument } from "./runtime/create-seed-document.ts";
import { createVscodeEditorNavigator } from "./vscode-editor-navigator.ts";

type Disposable = {
  dispose(): void;
};

type ExtensionContextLike = {
  subscriptions?: Disposable[];
  workspaceState?: CreateExtensionRuntimeOptions["workspaceState"];
  extensionPath?: string;
};

type RuntimeFactory = (options?: CreateExtensionRuntimeOptions) => ExtensionRuntime;
type BindingsFactory = (options: {
  runtime: ExtensionRuntime;
  host: ExtensionHost;
  extensionPath: string;
}) => Disposable | Promise<Disposable>;

type LoadVscodeApi = () => Promise<VscodeLike>;

type ActivateOptions = {
  runtimeFactory?: RuntimeFactory;
  bindingsFactory?: BindingsFactory;
  loadVscodeApi?: LoadVscodeApi;
};

let runtime: ExtensionRuntime | null = null;
let orchestration: Disposable | null = null;

async function activate(
  context?: ExtensionContextLike,
  {
    runtimeFactory = createExtensionRuntime,
    bindingsFactory = createExtensionBindings,
    loadVscodeApi = loadVscodeApiDefault,
  }: ActivateOptions = {},
): Promise<ExtensionRuntime> {
  const vscodeApi = await loadVscodeApi();
  const host = createVscodeExtensionHost({ vscode: vscodeApi });
  const editorNavigator = createVscodeEditorNavigator({ vscode: vscodeApi });

  runtime = runtimeFactory({
    workspaceState: context?.workspaceState,
    initialDocument: createSeedDocument({
      workspaceRootUri: vscodeApi.workspace.workspaceFolders?.[0]?.uri.toString(),
    }),
    revealBeacon: editorNavigator.revealBeacon,
  });

  const bindings = await bindingsFactory({
    runtime,
    host,
    extensionPath: context?.extensionPath ?? process.cwd(),
  });

  if (shouldAutoFocusOnStartup(vscodeApi)) {
    await host.focusFaroView();
  }

  orchestration = {
    dispose() {
      bindings.dispose();
      editorNavigator.dispose();
    },
  };

  if (Array.isArray(context?.subscriptions)) {
    context.subscriptions.push(runtime, orchestration);
  }

  return runtime;
}

function deactivate(): void {
  orchestration?.dispose();
  orchestration = null;
  runtime?.dispose();
  runtime = null;
}

const loadVscodeApiDefault: LoadVscodeApi = () => import("vscode") as unknown as Promise<VscodeLike>;

function shouldAutoFocusOnStartup(vscodeApi: VscodeLike): boolean {
  return vscodeApi.workspace.getConfiguration("faro").get("autoFocusOnStartup", false);
}

export { activate, deactivate };
