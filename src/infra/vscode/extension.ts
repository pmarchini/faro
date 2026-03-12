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
import { createVscodeEditorNavigator } from "./vscode-editor-navigator.ts";

type Disposable = {
  dispose(): void;
};

type ExtensionContextLike = {
  subscriptions?: Disposable[];
  workspaceState?: CreateExtensionRuntimeOptions["workspaceState"];
};

type RuntimeFactory = (options?: CreateExtensionRuntimeOptions) => ExtensionRuntime;
type BindingsFactory = (options: {
  runtime: ExtensionRuntime;
  host: ExtensionHost;
}) => Disposable;

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
    revealBeacon: editorNavigator.revealBeacon,
  });

  const bindings = bindingsFactory({
    runtime,
    host,
  });

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

export { activate, deactivate };
