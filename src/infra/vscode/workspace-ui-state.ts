type MementoLike = {
  get(key: string): unknown;
  update(key: string, value: unknown): Promise<void>;
};

export type WorkspaceUiStateSnapshot = {
  welcomeDismissed: boolean;
};

export type WorkspaceUiState = {
  load(): WorkspaceUiStateSnapshot;
  dismissWelcome(): Promise<void>;
};

type Options = {
  memento: MementoLike;
  storageKey?: string;
};

const DEFAULT_STATE: WorkspaceUiStateSnapshot = {
  welcomeDismissed: false,
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
    };
  }

  return DEFAULT_STATE;
}
