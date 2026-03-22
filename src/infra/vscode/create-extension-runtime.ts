import { createFaroRuntime, type FaroRuntime } from "../../app/runtime/create-faro-runtime.ts";
import { createEmptyDocument, type Beacon } from "../../core/model/document.ts";
import { createInMemoryStore, type InMemoryStore } from "../../core/services/in-memory-store.ts";
import { createCommandController } from "./command-controller.ts";
import {
  createRuntimeCommands,
  type RuntimeCommands,
} from "./commands/create-runtime-commands.ts";
import type { RevealResult } from "./reveal-result.ts";
import { createWorkspaceStateStore } from "./workspace-state-store.ts";
import type { FaroDocument } from "../../core/model/document.ts";
import { createWorkspaceUiState, type WorkspaceUiState } from "./workspace-ui-state.ts";

type Disposable = {
  dispose(): void;
};

type MementoLike = {
  get(key: string): unknown;
  update(key: string, value: unknown): Promise<void>;
};

export type ExtensionRuntime = Disposable & {
  readonly status: "ready";
  readonly store: InMemoryStore;
  readonly uiState: WorkspaceUiState;
  readonly agent: FaroRuntime<WorkspaceUiState>["agent"];
  readonly mcp: {
    readonly tools: FaroRuntime<WorkspaceUiState>["mcp"]["tools"];
    readonly resources: FaroRuntime<WorkspaceUiState>["mcp"]["resources"];
  };
  readonly commands: RuntimeCommands;
  subscribeToRefresh(listener: () => void): () => void;
  refresh(): void;
};

export type CreateExtensionRuntimeOptions = {
  workspaceState?: MementoLike;
  revealBeacon?(beacon: Beacon): Promise<RevealResult>;
  initialDocument?: FaroDocument;
};

export function createExtensionRuntime({
  workspaceState,
  revealBeacon = async () => ({ status: "revealed" }),
  initialDocument = createEmptyDocument(),
}: CreateExtensionRuntimeOptions = {}): ExtensionRuntime {
  const uiState = workspaceState
    ? createWorkspaceUiState({
        memento: workspaceState,
      })
    : createWorkspaceUiState({
        memento: createInMemoryMemento(),
      });
  const store = workspaceState
    ? createWorkspaceStateStore({
        memento: workspaceState,
        initialDocument,
      })
    : createInMemoryStore(initialDocument);
  const runtime = createFaroRuntime({
    store,
    uiState,
  });
  const controller = createCommandController({ store, revealBeacon });
  const commands = createRuntimeCommands({ controller });

  return {
    ...runtime,
    commands,
  };
}

function createInMemoryMemento(): MementoLike {
  const state = new Map<string, unknown>();

  return {
    get(key: string) {
      return state.get(key);
    },
    update(key: string, value: unknown) {
      state.set(key, value);
      return Promise.resolve();
    },
  };
}
