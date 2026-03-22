import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../../../../src/core/services/in-memory-store.ts";
import { createMainWebviewViewProvider } from "../../../../../src/infra/vscode/ui/main-view/main-view-provider.ts";
import * as fixtures from "../../../../core/fixtures.ts";

type Message = {
  type: string;
  scope?: "local" | "global";
  targetId?: string;
  pathId?: string;
  pathTitle?: string;
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

test("setup install requires explicit confirmation before delegating to the service", async () => {
  const calls: string[] = [];
  let installed = false;
  const provider = createMainWebviewViewProvider({
    store: createInMemoryStore(fixtures.createDocument()),
    uiState: createUiState("setup"),
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
        return [
          {
            id: "claude",
            status: installed ? ("installed" as const) : ("missing" as const),
          },
        ];
      },
      async installTarget(scope, targetId) {
        calls.push(`install:${scope}:${targetId}`);
        installed = true;
      },
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  await Promise.resolve();
  await view.emit({ type: "main.setupRequestInstallTarget", targetId: "claude" });

  assert.match(view.webview.html, /Confirm install/);
  assert.deepEqual(calls, ["load:local"]);

  await view.emit({ type: "main.setupCancelInstallTarget" });

  assert.doesNotMatch(view.webview.html, /Confirm install/);
  assert.deepEqual(calls, ["load:local"]);

  await view.emit({ type: "main.setupRequestInstallTarget", targetId: "claude" });
  await view.emit({ type: "main.setupConfirmInstallTarget", targetId: "claude" });

  assert.deepEqual(calls, ["load:local", "install:local:claude", "load:local"]);
  assert.match(view.webview.html, /Installed/);
});

test("leaving setup clears pending install confirmation in the main shell", async () => {
  const calls: string[] = [];
  const provider = createMainWebviewViewProvider({
    store: createInMemoryStore(fixtures.createDocument()),
    uiState: createUiState("setup"),
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
        return [{ id: "claude", status: "missing" as const }];
      },
      async installTarget(scope, targetId) {
        calls.push(`install:${scope}:${targetId}`);
      },
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  await Promise.resolve();
  await view.emit({ type: "main.setupRequestInstallTarget", targetId: "claude" });

  assert.match(view.webview.html, /Confirm install/);

  await view.emit({ type: "main.openHome" });

  assert.doesNotMatch(view.webview.html, /Confirm install/);
  assert.match(view.webview.html, /Resume Current Path/);
  assert.deepEqual(calls, ["load:local"]);

  await view.emit({ type: "main.openSetup" });

  assert.doesNotMatch(view.webview.html, /Confirm install/);
  assert.deepEqual(calls, ["load:local"]);
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

test("confirming path delete removes the active path from the view", async () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const provider = createMainWebviewViewProvider({
    store,
    uiState: createUiState("path"),
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
  await view.emit({ type: "main.requestDeletePath", pathId: "auth-flow", pathTitle: "Auth Flow" });

  assert.match(view.webview.html, /Delete current path\?/);

  await view.emit({ type: "main.confirmDeletePath", pathId: "auth-flow" });

  assert.equal(store.load().activePathId, null);
  assert.equal(store.load().paths.length, 0);
  assert.match(view.webview.html, /No active path/);
});
