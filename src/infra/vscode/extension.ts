import {
  createExtensionRuntime,
  type ExtensionRuntime,
} from "./create-extension-runtime.ts";

type Disposable = {
  dispose(): void;
};

type ExtensionContextLike = {
  subscriptions?: Disposable[];
};

let runtime: ExtensionRuntime | null = null;

function activate(context?: ExtensionContextLike): ExtensionRuntime {
  runtime = createExtensionRuntime();

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
