import { fileURLToPath } from "node:url";

import { createEmptyDocument } from "../../core/model/document.ts";
import {
  registerVscodeBindings,
  type ExtensionHost,
} from "./composition/register-vscode-bindings.ts";
import { createVscodeExtensionHost } from "./bindings/create-vscode-extension-host.ts";
import {
  createExtensionRuntime,
  type CreateExtensionRuntimeOptions,
  type ExtensionRuntime,
} from "./create-extension-runtime.ts";
import { createClaudeCodeFollower } from "./follow/claude-code-follower.ts";
import { createVscodeFollowPorts } from "./follow/vscode-follow-ports.ts";
import type { VscodeLike } from "./vscode-api.ts";
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
  workspaceRoot: string;
}) => Disposable | Promise<Disposable>;

type LoadVscodeApi = () => Promise<VscodeLike>;
type FollowerFactory = (options: { vscode: VscodeLike; workspaceRoot: string }) => Disposable;

type ActivateOptions = {
  runtimeFactory?: RuntimeFactory;
  bindingsFactory?: BindingsFactory;
  loadVscodeApi?: LoadVscodeApi;
  followerFactory?: FollowerFactory;
};

let runtime: ExtensionRuntime | null = null;
let orchestration: Disposable | null = null;

async function activate(
  context?: ExtensionContextLike,
  {
    runtimeFactory = createExtensionRuntime,
    bindingsFactory = registerVscodeBindings,
    loadVscodeApi = loadVscodeApiDefault,
    followerFactory = followClaudeCode,
  }: ActivateOptions = {},
): Promise<ExtensionRuntime> {
  const vscodeApi = await loadVscodeApi();
  const host = createVscodeExtensionHost({ vscode: vscodeApi });
  const editorNavigator = createVscodeEditorNavigator({ vscode: vscodeApi });
  const workspaceRoot =
    getPrimaryWorkspaceRoot(vscodeApi) ?? context?.extensionPath ?? process.cwd();

  runtime = runtimeFactory({
    workspaceState: context?.workspaceState,
    initialDocument: createEmptyDocument(),
    revealBeacon: editorNavigator.revealBeacon,
  });

  const bindings = await bindingsFactory({
    runtime,
    host,
    extensionPath: context?.extensionPath ?? process.cwd(),
    workspaceRoot,
  });

  const follower = followerFactory({ vscode: vscodeApi, workspaceRoot });

  if (shouldAutoFocusOnStartup(vscodeApi)) {
    await host.focusFaroView();
  }

  orchestration = {
    dispose() {
      bindings.dispose();
      editorNavigator.dispose();
      follower.dispose();
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

const followClaudeCode: FollowerFactory = ({ vscode, workspaceRoot }) =>
  createClaudeCodeFollower({ workspaceRoot, ports: createVscodeFollowPorts({ vscode }) });

function shouldAutoFocusOnStartup(vscodeApi: VscodeLike): boolean {
  return vscodeApi.workspace.getConfiguration("faro").get("autoFocusOnStartup", false);
}

function getPrimaryWorkspaceRoot(vscodeApi: VscodeLike): string | null {
  const rootUri = vscodeApi.workspace.workspaceFolders?.[0]?.uri?.toString();

  if (!rootUri?.startsWith("file://")) {
    return null;
  }

  return fileURLToPath(rootUri);
}

export { activate, deactivate };
