import type { Beacon } from "../../core/model/document.ts";
import { createInMemoryStore, type InMemoryStore } from "../../core/services/in-memory-store.ts";
import { createCommandController } from "./command-controller.ts";
import {
  createRuntimeCommands,
  type RuntimeCommands,
} from "./commands/create-runtime-commands.ts";
import type { RevealResult } from "./reveal-result.ts";
import { createSeedDocument } from "./runtime/create-seed-document.ts";
import { createWorkspaceStateStore } from "./workspace-state-store.ts";
import type { FaroDocument } from "../../core/model/document.ts";

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
  initialDocument = createSeedDocument(),
}: CreateExtensionRuntimeOptions = {}): ExtensionRuntime {
  const listeners = new Set<() => void>();
  const store = workspaceState
    ? createWorkspaceStateStore({
        memento: workspaceState,
        initialDocument,
      })
    : createInMemoryStore(initialDocument);
  const controller = createCommandController({ store, revealBeacon });
  const commands = createRuntimeCommands({
    controller,
    notifyRefresh: refresh,
  });

  return {
    status: "ready",
    store,
    commands,
    subscribeToRefresh,
    refresh,
    dispose() {
      listeners.clear();
    },
  };

  function subscribeToRefresh(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function refresh(): void {
    for (const listener of listeners) {
      listener();
    }
  }
}
