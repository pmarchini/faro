import { buildSetupViewModel } from "../../app/views/setup-view-model.ts";
import type {
  SetupScope,
  SetupStateSnapshot,
  SetupTargetId,
} from "../../setup/setup-contract.ts";
import type { SetupIntegrationService } from "../tooling/setup-integration-service.ts";
import { createSetupWebviewAdapter } from "./setup-webview.ts";

type Disposable = {
  dispose(): void;
};

type WebviewViewLike = {
  webview: {
    html: string;
    onDidReceiveMessage(
      listener: (message: { type: string }) => void | Promise<void>,
    ): Disposable;
  };
};

export function createSetupWebviewViewProvider({
  service,
}: {
  service: SetupIntegrationService;
}): Disposable & {
  resolveWebviewView(view: WebviewViewLike): void;
  refresh(): void;
} {
  let adapter: ReturnType<typeof createSetupWebviewAdapter> | null = null;
  let loadVersion = 0;
  let snapshot: SetupStateSnapshot = {
    scope: "local",
    isLoading: true,
    targets: [],
  };

  return {
    resolveWebviewView(view: WebviewViewLike) {
      adapter?.dispose();
      adapter = createSetupWebviewAdapter({
        webview: view.webview,
        getViewModel: () => buildSetupViewModel(snapshot),
        onSelectScope: async (scope) => {
          await loadTargets(scope);
        },
        onInstallTarget: async (targetId) => {
          await installTarget(targetId);
        },
      });
      adapter.render();
      void loadTargets(snapshot.scope);
    },
    refresh() {
      void loadTargets(snapshot.scope);
    },
    dispose() {
      adapter?.dispose();
      adapter = null;
    },
  };

  async function loadTargets(scope: SetupScope): Promise<void> {
    const currentVersion = ++loadVersion;
    snapshot = {
      scope,
      isLoading: true,
      targets: [],
      feedback: snapshot.feedback,
    };
    adapter?.render();

    try {
      const targets = await service.loadTargets(scope);
      if (currentVersion !== loadVersion) {
        return;
      }

      snapshot = {
        scope,
        isLoading: false,
        targets,
        feedback: snapshot.feedback,
      };
      adapter?.render();
    } catch (error) {
      if (currentVersion !== loadVersion) {
        return;
      }

      snapshot = {
        scope,
        isLoading: false,
        targets: [],
        feedback: {
          kind: "error",
          message: toErrorMessage(error, "Unable to load integration status."),
        },
      };
      adapter?.render();
    }
  }

  async function installTarget(targetId: SetupTargetId): Promise<void> {
    try {
      await service.installTarget(snapshot.scope, targetId);
      snapshot = {
        ...snapshot,
        feedback: {
          kind: "success",
          message: `Installed ${formatTargetName(targetId)}.`,
        },
      };
      await loadTargets(snapshot.scope);
    } catch (error) {
      snapshot = {
        ...snapshot,
        feedback: {
          kind: "error",
          message: toErrorMessage(error, `Unable to install ${formatTargetName(targetId)}.`),
        },
      };
      adapter?.render();
    }
  }
}

function formatTargetName(targetId: SetupTargetId): string {
  if (targetId === "claude") {
    return "Claude";
  }

  if (targetId === "copilotInstructions") {
    return "Copilot Instructions";
  }

  if (targetId === "copilotAgent") {
    return "Copilot Agent";
  }

  return "Codex Skill";
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
