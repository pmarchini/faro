import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { createNavigatorWebviewViewProvider } from "../../src/infra/vscode/navigator-webview-view-provider.ts";
import * as fixtures from "../core/fixtures.ts";

type NavigatorMessage = {
  type: string;
  pathId?: string;
  beaconId?: string;
};

function createWebviewView() {
  let listener: ((message: NavigatorMessage) => void | Promise<void>) | null = null;

  return {
    webview: {
      html: "",
      onDidReceiveMessage(nextListener: (message: NavigatorMessage) => void | Promise<void>) {
        listener = nextListener;
        return {
          dispose() {
            listener = null;
          },
        };
      },
    },
    async emit(message: NavigatorMessage) {
      await listener?.(message);
    },
  };
}

test("resolved navigator view renders the current beacon", () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const provider = createNavigatorWebviewViewProvider({
    store,
    commands: {
      previousBeacon: async () => ({ status: "idle" as const }),
      nextBeacon: async () => ({ status: "idle" as const }),
      revealCurrentBeacon: async () => ({ status: "idle" as const }),
      setCurrentBeacon: async () => ({ status: "idle" as const }),
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);

  assert.match(view.webview.html, /Auth Flow \/ Beacon b1/);
  assert.match(view.webview.html, /1 of 2/);
});

test("navigator messages drive runtime commands and rerender the view", async () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const calls: string[] = [];
  const provider = createNavigatorWebviewViewProvider({
    store,
    commands: {
      previousBeacon: async () => {
        calls.push("previous");
        return { status: "idle" as const };
      },
      nextBeacon: async () => {
        calls.push("next");
        store.setCurrentBeacon("auth-flow", "b2");
        return { status: "revealed" as const, beaconId: "b2" };
      },
      revealCurrentBeacon: async () => {
        calls.push("reveal");
        return { status: "revealed" as const, beaconId: "b2" };
      },
      setCurrentBeacon: async (pathId, beaconId) => {
        calls.push(`select:${pathId}:${beaconId}`);
        store.setCurrentBeacon(pathId, beaconId);
        return { status: "revealed" as const, beaconId };
      },
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  await view.emit({ type: "navigator.next" });
  await view.emit({ type: "navigator.selectBeacon", pathId: "auth-flow", beaconId: "b1" });
  await view.emit({ type: "navigator.reveal" });

  assert.deepEqual(calls, ["next", "select:auth-flow:b1", "reveal"]);
  assert.match(view.webview.html, /Beacon b1/);
  assert.match(view.webview.html, /1 of 2/);
});

test("refresh rerenders the resolved navigator from store state", () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const provider = createNavigatorWebviewViewProvider({
    store,
    commands: {
      previousBeacon: async () => ({ status: "idle" as const }),
      nextBeacon: async () => ({ status: "idle" as const }),
      revealCurrentBeacon: async () => ({ status: "idle" as const }),
      setCurrentBeacon: async () => ({ status: "idle" as const }),
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  store.setCurrentBeacon("auth-flow", "b2");
  provider.refresh();

  assert.match(view.webview.html, /Beacon b2/);
  assert.match(view.webview.html, /2 of 2/);
});
