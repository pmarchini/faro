import assert from "node:assert/strict";
import test from "node:test";

import type { SetupTargetSnapshot } from "../../src/setup/setup-contract.ts";
import { createSetupWebviewViewProvider } from "../../src/infra/vscode/setup-webview-view-provider.ts";

type SetupMessage = {
  type: string;
  scope?: "local" | "global";
  targetId?: string;
};

function createWebviewView() {
  let listener: ((message: SetupMessage) => void | Promise<void>) | null = null;

  return {
    webview: {
      html: "",
      onDidReceiveMessage(nextListener: (message: SetupMessage) => void | Promise<void>) {
        listener = nextListener;
        return {
          dispose() {
            listener = null;
          },
        };
      },
    },
    async emit(message: SetupMessage) {
      await listener?.(message);
    },
  };
}

test("resolved setup view renders loading first and then loaded local statuses", async () => {
  let resolveLoad: ((value: SetupTargetSnapshot[]) => void) | null = null;
  const provider = createSetupWebviewViewProvider({
    service: {
      loadTargets() {
        return new Promise<SetupTargetSnapshot[]>((resolve) => {
          resolveLoad = resolve;
        });
      },
      async installTarget() {},
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);

  assert.match(view.webview.html, /Checking integrations\.\.\./);

  const finishLoading: (value: SetupTargetSnapshot[]) => void =
    resolveLoad ??
    (() => {
      throw new Error("expected the initial load promise to be pending");
    });
  finishLoading([{ id: "claude", status: "missing" }]);
  await Promise.resolve();

  assert.match(view.webview.html, /Claude/);
  assert.match(view.webview.html, /Missing/);
});

test("switching scope reloads statuses and rerenders the setup view", async () => {
  const calls: string[] = [];
  const provider = createSetupWebviewViewProvider({
    service: {
      async loadTargets(scope) {
        calls.push(`load:${scope}`);
        return scope === "local"
          ? [{ id: "claude", status: "missing" as const }]
          : [{ id: "claude", status: "installed" as const }];
      },
      async installTarget() {},
    },
  });
  const view = createWebviewView();

  provider.resolveWebviewView(view);
  await Promise.resolve();
  await view.emit({ type: "setup.setScope", scope: "global" });

  assert.deepEqual(calls, ["load:local", "load:global"]);
  assert.match(view.webview.html, /Installed/);
});

test("installing one target delegates to the service, reloads statuses, and rerenders", async () => {
  const calls: string[] = [];
  let installed = false;
  const provider = createSetupWebviewViewProvider({
    service: {
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
  await view.emit({ type: "setup.installTarget", targetId: "claude" });

  assert.deepEqual(calls, ["load:local", "install:local:claude", "load:local"]);
  assert.match(view.webview.html, /Installed/);
});
