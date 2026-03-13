import { buildNavigatorViewModel } from "../../app/views/navigator-view-model.ts";
import type { InMemoryStore } from "../../core/services/in-memory-store.ts";
import type { RuntimeCommands } from "./commands/create-runtime-commands.ts";
import { createNavigatorWebviewAdapter } from "./navigator-webview.ts";

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

type NavigatorCommandSurface = Pick<
  RuntimeCommands,
  "previousBeacon" | "nextBeacon" | "revealCurrentBeacon" | "setCurrentBeacon"
>;

export function createNavigatorWebviewViewProvider({
  store,
  commands,
}: {
  store: Pick<InMemoryStore, "load">;
  commands: NavigatorCommandSurface;
}): Disposable & {
  resolveWebviewView(view: WebviewViewLike): void;
  refresh(): void;
} {
  let adapter: ReturnType<typeof createNavigatorWebviewAdapter> | null = null;

  return {
    resolveWebviewView(view: WebviewViewLike) {
      adapter?.dispose();
      adapter = createNavigatorWebviewAdapter({
        webview: view.webview,
        getViewModel: () => buildNavigatorViewModel(store.load()),
        onPrevious: async () => {
          await commands.previousBeacon();
        },
        onNext: async () => {
          await commands.nextBeacon();
        },
        onReveal: async () => {
          await commands.revealCurrentBeacon();
        },
        onSelectBeacon: async (pathId, beaconId) => {
          await commands.setCurrentBeacon(pathId, beaconId);
        },
      });
      adapter.render();
    },
    refresh() {
      adapter?.render();
    },
    dispose() {
      adapter?.dispose();
      adapter = null;
    },
  };
}
