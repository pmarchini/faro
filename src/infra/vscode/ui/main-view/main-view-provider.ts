import { buildHomeViewModel } from "../../../../app/views/home-view-model.ts";
import { buildNavigatorViewModel } from "../../../../app/views/navigator-view-model.ts";
import {
  buildSetupViewModel,
} from "../../../../app/views/setup-view-model.ts";
import type { InMemoryStore } from "../../../../core/services/in-memory-store.ts";
import type { SetupStateSnapshot, SetupTargetId } from "../../../../setup/setup-contract.ts";
import { formatSetupTargetName } from "../../../../setup/setup-target-definitions.ts";
import type { MainRoute } from "../../../../ui/main-route.ts";
import type { RuntimeCommands } from "../../commands/create-runtime-commands.ts";
import { createMainWebviewAdapter, type MainWebviewViewModel } from "./main-view-adapter.ts";
import type { SetupIntegrationService } from "../../../tooling/setup-integration-service.ts";

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

type UiStateSurface = {
  load(): {
    selectedMainRoute: MainRoute;
  };
  setSelectedMainRoute(route: MainRoute): Promise<void>;
};

type CommandSurface = Pick<
  RuntimeCommands,
  "previousBeacon" | "nextBeacon" | "revealCurrentBeacon" | "setCurrentBeacon"
>;

export function createMainWebviewViewProvider({
  store,
  uiState,
  commands,
  setupService,
  route,
  focusView,
}: {
  store: Pick<InMemoryStore, "load" | "deletePath">;
  uiState: UiStateSurface;
  commands: CommandSurface;
  setupService: SetupIntegrationService;
  route?: MainRoute;
  focusView?(viewId: "faro.home" | "faro.path" | "faro.setup"): Promise<void>;
}): Disposable & {
  resolveWebviewView(view: WebviewViewLike): void;
  refresh(): void;
} {
  let adapter: ReturnType<typeof createMainWebviewAdapter> | null = null;
  let selectedRoute: MainRoute = route ?? uiState.load().selectedMainRoute;
  let loadVersion = 0;
  let pendingPathDeleteConfirmation:
    | {
      pathId: string;
      pathTitle: string;
    }
    | undefined;
  let setupSnapshot: SetupStateSnapshot = {
    scope: "local",
    isLoading: false,
    targets: [],
  };

  return {
    resolveWebviewView(view) {
      adapter?.dispose();
      adapter = createMainWebviewAdapter({
        webview: view.webview,
        getViewModel: buildViewModel,
        onOpenHome: async () => {
          await setRoute("home");
        },
        onOpenPath: async () => {
          await setRoute("path");
        },
        onOpenSetup: async () => {
          await setRoute("setup");
        },
        onPrevious: async () => {
          await commands.previousBeacon();
        },
        onNext: async () => {
          await commands.nextBeacon();
        },
        onReveal: async () => {
          await commands.revealCurrentBeacon();
        },
        onRequestDeletePath: async (pathId, pathTitle) => {
          requestPathDelete(pathId, pathTitle);
        },
        onCancelDeletePath: async () => {
          cancelPathDelete();
        },
        onConfirmDeletePath: async (pathId) => {
          confirmPathDelete(pathId);
        },
        onSelectBeacon: async (pathId, beaconId) => {
          await commands.setCurrentBeacon(pathId, beaconId);
        },
        onSetupSelectScope: async (scope) => {
          await loadSetupTargets(scope);
        },
        onSetupRequestInstallTarget: async (targetId) => {
          requestSetupTargetInstall(targetId);
        },
        onSetupCancelInstallTarget: async () => {
          cancelSetupTargetInstall();
        },
        onSetupConfirmInstallTarget: async (targetId) => {
          await installSetupTarget(targetId);
        },
      });
      adapter.render();
      if (selectedRoute === "setup") {
        void loadSetupTargets(setupSnapshot.scope);
      }
    },
    refresh() {
      adapter?.render();
    },
    dispose() {
      adapter?.dispose();
      adapter = null;
    },
  };

  function buildViewModel(): MainWebviewViewModel {
    const document = store.load();

    return {
      selectedRoute,
      isFixedRoute: Boolean(route),
      routes: [
        { id: "home", label: "Home", isSelected: selectedRoute === "home" },
        { id: "path", label: "Path", isSelected: selectedRoute === "path" },
        { id: "setup", label: "Setup", isSelected: selectedRoute === "setup" },
      ],
      home: buildHomeViewModel(document),
      path: buildNavigatorViewModel(document, { showWelcome: false }),
      pendingPathDeleteConfirmation,
      setup: buildSetupViewModel(setupSnapshot),
    };
  }

  async function setRoute(route: MainRoute): Promise<void> {
    if (route !== selectedRoute && focusView && route !== currentRoute()) {
      await focusView(viewIdForRoute(route));
      return;
    }

    if (selectedRoute === route) {
      if (route === "setup" && setupSnapshot.targets.length === 0 && !setupSnapshot.isLoading) {
        await loadSetupTargets(setupSnapshot.scope);
      }
      return;
    }

    if (route !== "setup" && setupSnapshot.pendingInstallConfirmation) {
      setupSnapshot = {
        ...setupSnapshot,
        pendingInstallConfirmation: undefined,
      };
    }

    if (route !== "path") {
      pendingPathDeleteConfirmation = undefined;
    }

    selectedRoute = route;
    if (!focusView) {
      await uiState.setSelectedMainRoute(route);
    }
    adapter?.render();

    if (route === "setup" && setupSnapshot.targets.length === 0 && !setupSnapshot.isLoading) {
      await loadSetupTargets(setupSnapshot.scope);
    }
  }

  async function loadSetupTargets(scope: SetupStateSnapshot["scope"]): Promise<void> {
    const currentVersion = ++loadVersion;
    setupSnapshot = {
      scope,
      isLoading: true,
      targets: [],
      pendingInstallConfirmation: undefined,
      feedback: setupSnapshot.feedback,
    };
    adapter?.render();

    try {
      const targets = await setupService.loadTargets(scope);
      if (currentVersion !== loadVersion) {
        return;
      }

      setupSnapshot = {
        scope,
        isLoading: false,
        targets,
        pendingInstallConfirmation: undefined,
        feedback: setupSnapshot.feedback,
      };
      adapter?.render();
    } catch (error) {
      if (currentVersion !== loadVersion) {
        return;
      }

      setupSnapshot = {
        scope,
        isLoading: false,
        targets: [],
        pendingInstallConfirmation: undefined,
        feedback: {
          kind: "error",
          message: error instanceof Error && error.message
            ? error.message
            : "Unable to load integration status.",
        },
      };
      adapter?.render();
    }
  }

  function requestSetupTargetInstall(targetId: SetupTargetId): void {
    setupSnapshot = {
      ...setupSnapshot,
      pendingInstallConfirmation: { targetId },
    };
    adapter?.render();
  }

  function cancelSetupTargetInstall(): void {
    setupSnapshot = {
      ...setupSnapshot,
      pendingInstallConfirmation: undefined,
    };
    adapter?.render();
  }

  async function installSetupTarget(targetId: SetupTargetId): Promise<void> {
    if (setupSnapshot.pendingInstallConfirmation?.targetId !== targetId) {
      return;
    }

    try {
      await setupService.installTarget(setupSnapshot.scope, targetId);
      setupSnapshot = {
        ...setupSnapshot,
        pendingInstallConfirmation: undefined,
        feedback: {
          kind: "success",
          message: `Installed ${formatTargetName(targetId)}.`,
        },
      };
      await loadSetupTargets(setupSnapshot.scope);
    } catch (error) {
      setupSnapshot = {
        ...setupSnapshot,
        pendingInstallConfirmation: undefined,
        feedback: {
          kind: "error",
          message: error instanceof Error && error.message
            ? error.message
            : `Unable to install ${formatTargetName(targetId)}.`,
        },
      };
      adapter?.render();
    }
  }

  function requestPathDelete(pathId: string, pathTitle: string): void {
    pendingPathDeleteConfirmation = { pathId, pathTitle };
    adapter?.render();
  }

  function cancelPathDelete(): void {
    pendingPathDeleteConfirmation = undefined;
    adapter?.render();
  }

  function confirmPathDelete(pathId: string): void {
    if (pendingPathDeleteConfirmation?.pathId !== pathId) {
      return;
    }

    pendingPathDeleteConfirmation = undefined;
    store.deletePath(pathId);
    adapter?.render();
  }

  function currentRoute(): MainRoute {
    return route ?? selectedRoute;
  }
}

function formatTargetName(targetId: SetupTargetId): string {
  return formatSetupTargetName(targetId);
}

function viewIdForRoute(route: MainRoute): "faro.home" | "faro.path" | "faro.setup" {
  switch (route) {
    case "home":
      return "faro.home";
    case "path":
      return "faro.path";
    case "setup":
      return "faro.setup";
  }
}
