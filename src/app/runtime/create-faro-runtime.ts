import { createFaroAgentService, type FaroAgentService } from "../agent/create-faro-agent-service.ts";
import type { InMemoryStore } from "../../core/services/in-memory-store.ts";
import {
  createFaroMcpResources,
  type FaroMcpResources,
} from "../../infra/mcp/create-faro-mcp-resources.ts";
import {
  createFaroMcpTools,
  type FaroMcpToolSet,
} from "../../infra/mcp/create-faro-mcp-tools.ts";

type Disposable = {
  dispose(): void;
};

export type FaroRuntime<UiState> = Disposable & {
  readonly status: "ready";
  readonly store: InMemoryStore;
  readonly uiState: UiState;
  readonly agent: FaroAgentService;
  readonly mcp: {
    readonly tools: FaroMcpToolSet;
    readonly resources: FaroMcpResources;
  };
  subscribeToRefresh(listener: () => void): () => void;
  refresh(): void;
};

export function createFaroRuntime<UiState>({
  store,
  uiState,
}: {
  store: InMemoryStore;
  uiState: UiState;
}): FaroRuntime<UiState> {
  const listeners = new Set<() => void>();
  const agent = createFaroAgentService({ store });
  const mcp = {
    tools: createFaroMcpTools({ service: agent }),
    resources: createFaroMcpResources({ service: agent }),
  };
  const unsubscribeStore = store.subscribe(() => {
    refresh();
  });

  return {
    status: "ready",
    store,
    uiState,
    agent,
    mcp,
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
