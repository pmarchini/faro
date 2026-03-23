import type { HomeViewModel } from "../../../../app/views/home-view-model.ts";
import type { NavigatorViewModel } from "../../../../app/views/navigator-view-model.ts";
import type { SetupViewModel } from "../../../../app/views/setup-view-model.ts";
import type { SetupScope, SetupTargetId } from "../../../../setup/setup-contract.ts";
import type { MainRoute } from "../../../../ui/main-route.ts";

export const mainMessageType = {
  openHome: "main.openHome",
  openPath: "main.openPath",
  openSetup: "main.openSetup",
  previous: "main.previous",
  next: "main.next",
  reveal: "main.reveal",
  requestDeletePath: "main.requestDeletePath",
  cancelDeletePath: "main.cancelDeletePath",
  confirmDeletePath: "main.confirmDeletePath",
  selectBeacon: "main.selectBeacon",
  setupSetScope: "main.setupSetScope",
  setupRequestInstallTarget: "main.setupRequestInstallTarget",
  setupCancelInstallTarget: "main.setupCancelInstallTarget",
  setupConfirmInstallTarget: "main.setupConfirmInstallTarget",
} as const;

export type MainMessage =
  | { type: typeof mainMessageType.openHome }
  | { type: typeof mainMessageType.openPath }
  | { type: typeof mainMessageType.openSetup }
  | { type: typeof mainMessageType.previous }
  | { type: typeof mainMessageType.next }
  | { type: typeof mainMessageType.reveal }
  | { type: typeof mainMessageType.requestDeletePath; pathId: string; pathTitle: string }
  | { type: typeof mainMessageType.cancelDeletePath }
  | { type: typeof mainMessageType.confirmDeletePath; pathId: string }
  | { type: typeof mainMessageType.selectBeacon; pathId: string; beaconId: string }
  | { type: typeof mainMessageType.setupSetScope; scope: SetupScope }
  | { type: typeof mainMessageType.setupRequestInstallTarget; targetId: SetupTargetId }
  | { type: typeof mainMessageType.setupCancelInstallTarget }
  | { type: typeof mainMessageType.setupConfirmInstallTarget; targetId: SetupTargetId };

export const mainMessage = {
  openHome(): MainMessage {
    return { type: mainMessageType.openHome };
  },
  openPath(): MainMessage {
    return { type: mainMessageType.openPath };
  },
  openSetup(): MainMessage {
    return { type: mainMessageType.openSetup };
  },
  previous(): MainMessage {
    return { type: mainMessageType.previous };
  },
  next(): MainMessage {
    return { type: mainMessageType.next };
  },
  reveal(): MainMessage {
    return { type: mainMessageType.reveal };
  },
  requestDeletePath(pathId: string, pathTitle: string): MainMessage {
    return {
      type: mainMessageType.requestDeletePath,
      pathId,
      pathTitle,
    };
  },
  cancelDeletePath(): MainMessage {
    return { type: mainMessageType.cancelDeletePath };
  },
  confirmDeletePath(pathId: string): MainMessage {
    return {
      type: mainMessageType.confirmDeletePath,
      pathId,
    };
  },
  selectBeacon(pathId: string, beaconId: string): MainMessage {
    return {
      type: mainMessageType.selectBeacon,
      pathId,
      beaconId,
    };
  },
  setupSetScope(scope: SetupScope): MainMessage {
    return {
      type: mainMessageType.setupSetScope,
      scope,
    };
  },
  setupRequestInstallTarget(targetId: SetupTargetId): MainMessage {
    return {
      type: mainMessageType.setupRequestInstallTarget,
      targetId,
    };
  },
  setupCancelInstallTarget(): MainMessage {
    return { type: mainMessageType.setupCancelInstallTarget };
  },
  setupConfirmInstallTarget(targetId: SetupTargetId): MainMessage {
    return {
      type: mainMessageType.setupConfirmInstallTarget,
      targetId,
    };
  },
};

export type MainWebviewViewModel = {
  selectedRoute: MainRoute;
  routes: Array<{
    id: MainRoute;
    label: string;
    isSelected: boolean;
  }>;
  home: HomeViewModel;
  path: NavigatorViewModel;
  pendingPathDeleteConfirmation?: {
    pathId: string;
    pathTitle: string;
  };
  setup: SetupViewModel;
};

export type MainViewBridge = {
  postMessage(message: MainMessage): void;
};

export function isMainMessage(message: unknown): message is MainMessage {
  if (!isRecord(message) || typeof message.type !== "string") {
    return false;
  }

  switch (message.type) {
    case mainMessageType.openHome:
    case mainMessageType.openPath:
    case mainMessageType.openSetup:
    case mainMessageType.previous:
    case mainMessageType.next:
    case mainMessageType.reveal:
    case mainMessageType.cancelDeletePath:
    case mainMessageType.setupCancelInstallTarget:
      return true;
    case mainMessageType.requestDeletePath:
      return typeof message.pathId === "string" && typeof message.pathTitle === "string";
    case mainMessageType.confirmDeletePath:
      return typeof message.pathId === "string";
    case mainMessageType.selectBeacon:
      return typeof message.pathId === "string" && typeof message.beaconId === "string";
    case mainMessageType.setupSetScope:
      return message.scope === "local" || message.scope === "global";
    case mainMessageType.setupRequestInstallTarget:
    case mainMessageType.setupConfirmInstallTarget:
      return isSetupTargetId(message.targetId);
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSetupTargetId(value: unknown): value is SetupTargetId {
  return value === "claude" ||
    value === "copilotInstructions" ||
    value === "copilotAgent" ||
    value === "codexSkill";
}
