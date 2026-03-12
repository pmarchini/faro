import {
  createExtensionRuntime,
  type CreateExtensionRuntimeOptions,
  type ExtensionRuntime,
} from "./create-extension-runtime.ts";

type Disposable = {
  dispose(): void;
};

type ExtensionContextLike = {
  subscriptions?: Disposable[];
  workspaceState?: CreateExtensionRuntimeOptions["workspaceState"];
};

let runtime: ExtensionRuntime | null = null;

type RuntimeFactory = (options?: CreateExtensionRuntimeOptions) => ExtensionRuntime;

function activate(
  context?: ExtensionContextLike,
  runtimeFactory: RuntimeFactory = createExtensionRuntime,
): ExtensionRuntime {
  runtime = runtimeFactory({
    workspaceState: context?.workspaceState,
  });

  if (Array.isArray(context?.subscriptions)) {
    context.subscriptions.push(runtime);
  }

  return runtime;
}

function deactivate() {
  runtime?.dispose();
  runtime = null;
}

export { activate, deactivate };
