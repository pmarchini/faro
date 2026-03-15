import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { createMainWebviewViewProvider } from "../../src/infra/vscode/main-webview-view-provider.ts";
import * as fixtures from "../core/fixtures.ts";

type Message = {
  type: string;
  scope?: "local" | "global";
  targetId?: string;
  pathId?: string;
  beaconId?: string;
};

function createWebviewView() {
  let listener: ((message: Message) => void | Promise<void>) | null = null;

  return {
    webview: {
      html: "",
      onDidReceiveMessage(nextListener: (message: Message) => void | Promise<void>) {
        listener = nextListener;
        return {
          dispose() {
            listener = null;
          },
        };
      },
    },
    async emit(message: Message) {
      await listener?.(message);
    },
  };
}

function createUiState(route: "home" | "path" | "setup" = "home") {
  let selectedMainRoute = route;

  return {
    load() {
      return {
        welcomeDismissed: true,
        selectedMainRoute,
      };
    },
    async dismissWelcome() {},
    async setSelectedMainRoute(nextRoute: "home" | "path" | "setup") {
      selectedMainRoute = nextRoute;
    },
  };
}

test("resolved main view renders the home route by default", () => {
  const provider = createMainWebviewViewProvider({
    store: createInMemoryStore(fixtures.createDocument()),
    uiState: createUiState("home"),
    commands: {
      async previousBeacon() {
        return { status: "idle" as const };
      },
      async nextBeacon() {
        return { status: "idle" as const };
      },
      async revealCurrentBeacon() {
        return { status: "idle" as const };
      },
      async setCurrentBeacon() {
        return { status: "idle" as const };
      },
    },
    setupService: {
      async loadTargets() {
        return [{ id: "claude", status: "missing" as const }];
      },
      async installTarget() {},
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);

  assert.match(view.webview.html, /Resume Current Path/);
  assert.match(view.webview.html, /Open Setup/);
});

test("opening setup persists the route and loads setup status", async () => {
  const calls: string[] = [];
  const provider = createMainWebviewViewProvider({
    store: createInMemoryStore(fixtures.createDocument()),
    uiState: createUiState("home"),
    commands: {
      async previousBeacon() {
        return { status: "idle" as const };
      },
      async nextBeacon() {
        return { status: "idle" as const };
      },
      async revealCurrentBeacon() {
        return { status: "idle" as const };
      },
      async setCurrentBeacon() {
        return { status: "idle" as const };
      },
    },
    setupService: {
      async loadTargets(scope) {
        calls.push(`load:${scope}`);
        return [{ id: "claude", status: "installed" as const }];
      },
      async installTarget() {},
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  await view.emit({ type: "main.openSetup" });

  assert.deepEqual(calls, ["load:local"]);
  assert.match(view.webview.html, /Agent setup/);
  assert.match(view.webview.html, /Installed/);
});

test("resuming the path switches to the path route and delegates path actions", async () => {
  const calls: string[] = [];
  const provider = createMainWebviewViewProvider({
    store: createInMemoryStore(fixtures.createDocument()),
    uiState: createUiState("home"),
    commands: {
      async previousBeacon() {
        calls.push("previous");
        return { status: "idle" as const };
      },
      async nextBeacon() {
        calls.push("next");
        return { status: "idle" as const };
      },
      async revealCurrentBeacon() {
        calls.push("reveal");
        return { status: "idle" as const };
      },
      async setCurrentBeacon(pathId, beaconId) {
        calls.push(`setCurrentBeacon:${pathId}:${beaconId}`);
        return { status: "idle" as const };
      },
    },
    setupService: {
      async loadTargets() {
        return [{ id: "claude", status: "missing" as const }];
      },
      async installTarget() {},
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  await view.emit({ type: "main.openPath" });
  await view.emit({ type: "main.next" });

  assert.match(view.webview.html, /Auth Flow/);
  assert.deepEqual(calls, ["next"]);
});
