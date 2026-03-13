import { createFaroAgentService, type FaroAgentService } from "../../app/agent/create-faro-agent-service.ts";
import type { Beacon } from "../../core/model/document.ts";
import { createInMemoryStore, type InMemoryStore } from "../../core/services/in-memory-store.ts";
import {
  createFaroMcpResources,
  type FaroMcpResources,
} from "../mcp/create-faro-mcp-resources.ts";
import {
  createFaroMcpTools,
  type FaroMcpToolSet,
} from "../mcp/create-faro-mcp-tools.ts";
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
  readonly agent: FaroAgentService;
  readonly mcp: {
    readonly tools: FaroMcpToolSet;
    readonly resources: FaroMcpResources;
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
  initialDocument = createSeedDocument(),
}: CreateExtensionRuntimeOptions = {}): ExtensionRuntime {
  const listeners = new Set<() => void>();
  const store = workspaceState
    ? createWorkspaceStateStore({
        memento: workspaceState,
        initialDocument,
      })
    : createInMemoryStore(initialDocument);
  const agent = createFaroAgentService({ store });
  const mcp = {
    tools: createFaroMcpTools({ service: agent }),
    resources: createFaroMcpResources({ service: agent }),
  };
  const controller = createCommandController({ store, revealBeacon });
  const unsubscribeStore = store.subscribe(() => {
    refresh();
  });
  const commands = createRuntimeCommands({ controller });

  return {
    status: "ready",
    store,
    agent,
    mcp,
    commands,
    subscribeToRefresh,
    refresh,
    dispose() {
      unsubscribeStore();
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
