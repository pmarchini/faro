import type { MainRoute } from "../../ui/main-route.ts";

type MementoLike = {
  get(key: string): unknown;
  update(key: string, value: unknown): Promise<void>;
};

export type WorkspaceUiStateSnapshot = {
  welcomeDismissed: boolean;
  selectedMainRoute: MainRoute;
};

export type WorkspaceUiState = {
  load(): WorkspaceUiStateSnapshot;
  dismissWelcome(): Promise<void>;
  setSelectedMainRoute(route: MainRoute): Promise<void>;
};

type Options = {
  memento: MementoLike;
  storageKey?: string;
};

const DEFAULT_STATE: WorkspaceUiStateSnapshot = {
  welcomeDismissed: false,
  selectedMainRoute: "home",
};

export function createWorkspaceUiState({
  memento,
  storageKey = "faro.ui",
}: Options): WorkspaceUiState {
  let snapshot = readStoredState(memento, storageKey);

  return {
    load() {
      return snapshot;
    },
    async dismissWelcome() {
      if (snapshot.welcomeDismissed) {
        return;
      }

      snapshot = {
        ...snapshot,
        welcomeDismissed: true,
      };

      await memento.update(storageKey, snapshot);
    },
    async setSelectedMainRoute(route) {
      if (snapshot.selectedMainRoute === route) {
        return;
      }

      snapshot = {
        ...snapshot,
        selectedMainRoute: route,
      };

      await memento.update(storageKey, snapshot);
    },
  };
}

function readStoredState(
  memento: MementoLike,
  storageKey: string,
): WorkspaceUiStateSnapshot {
  const storedState = memento.get(storageKey);

  if (
    storedState &&
    typeof storedState === "object" &&
    "welcomeDismissed" in storedState &&
    typeof storedState.welcomeDismissed === "boolean"
  ) {
    return {
      welcomeDismissed: storedState.welcomeDismissed,
      selectedMainRoute:
        "selectedMainRoute" in storedState &&
        (storedState.selectedMainRoute === "home" ||
          storedState.selectedMainRoute === "path" ||
          storedState.selectedMainRoute === "setup")
          ? storedState.selectedMainRoute
          : "home",
    };
  }

  return DEFAULT_STATE;
}
