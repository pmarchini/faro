import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { buildSetupViewModel } from "../../src/app/views/setup-view-model.ts";
import {
  createSetupWebviewAdapter,
  renderSetupHtml,
} from "../../src/infra/vscode/setup-webview.ts";

type WebviewMessage =
  | { type: "setup.setScope"; scope: "local" | "global" }
  | { type: "setup.installTarget"; targetId: string }
  | { type: "unknown" };

class FakeElement {
  dataset: Record<string, string>;
  parentElement: FakeElement | null;

  constructor(dataset: Record<string, string> = {}, parentElement: FakeElement | null = null) {
    this.dataset = dataset;
    this.parentElement = parentElement;
  }

  closest(selector: string): FakeElement | null {
    let current: FakeElement | null = this;

    while (current) {
      if (selector === "[data-action]" && typeof current.dataset.action === "string") {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }
}

function createFakeWebview() {
  let listener: ((message: WebviewMessage) => void | Promise<void>) | null = null;

  return {
    html: "",
    onDidReceiveMessage(callback: (message: WebviewMessage) => void | Promise<void>) {
      listener = callback;
      return {
        dispose() {
          listener = null;
        },
      };
    },
    async emit(message: WebviewMessage) {
      await listener?.(message);
    },
  };
}

function createViewModel() {
  return buildSetupViewModel({
    scope: "local",
    isLoading: false,
    targets: [
      { id: "claude", status: "missing" },
      { id: "copilotInstructions", status: "installed" },
      { id: "copilotAgent", status: "missing" },
      { id: "codexSkill", status: "missing" },
    ],
  });
}

function runSetupScript({
  html,
  clickTarget,
}: {
  html: string;
  clickTarget?: FakeElement;
}): { messages: WebviewMessage[] } {
  const messages: WebviewMessage[] = [];
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(scriptMatch, "expected setup html to include a script block");

  let clickListener: ((event: { target: FakeElement }) => void) | null = null;

  const context = {
    acquireVsCodeApi() {
      return {
        postMessage(message: WebviewMessage) {
          messages.push(message);
        },
      };
    },
    document: {
      addEventListener(eventName: string, listener: (event: { target: FakeElement }) => void) {
        if (eventName === "click") {
          clickListener = listener;
        }
      },
    },
    HTMLElement: FakeElement,
  };

  vm.runInNewContext(scriptMatch[1], context);

  if (clickTarget) {
    const invokeClick: (event: { target: FakeElement }) => void =
      clickListener ??
      (() => {
        throw new Error("expected setup html to register a click listener");
      });
    invokeClick({ target: clickTarget });
  }

  return { messages };
}

test("renderSetupHtml renders the loading shell", () => {
  const html = renderSetupHtml(
    buildSetupViewModel({
      scope: "local",
      isLoading: true,
      targets: [],
    }),
  );

  assert.match(html, /Agent setup/);
  assert.match(html, /Checking integrations\.\.\./);
});

test("renderSetupHtml renders statuses for the selected scope", () => {
  const html = renderSetupHtml(createViewModel());

  assert.match(html, /Agent setup/);
  assert.match(html, /Local/);
  assert.match(html, /Global/);
  assert.match(html, /Claude/);
  assert.match(html, /Copilot Instructions/);
  assert.match(html, /Installed/);
  assert.match(html, /Missing/);
  assert.match(html, /data-action="set-scope"/);
  assert.match(html, /data-action="install-target"/);
});

test("adapter routes scope and install actions through the callbacks and rerenders", async () => {
  const webview = createFakeWebview();
  const calls: string[] = [];
  let viewModel = createViewModel();
  const adapter = createSetupWebviewAdapter({
    webview,
    getViewModel: () => viewModel,
    onSelectScope: async (scope) => {
      calls.push(`scope:${scope}`);
      viewModel = buildSetupViewModel({
        scope,
        isLoading: false,
        targets: [
          { id: "claude", status: "installed" },
          { id: "copilotInstructions", status: "missing" },
          { id: "copilotAgent", status: "missing" },
          { id: "codexSkill", status: "missing" },
        ],
      });
    },
    onInstallTarget: async (targetId) => {
      calls.push(`install:${targetId}`);
    },
  });

  adapter.render();
  await webview.emit({ type: "setup.setScope", scope: "global" });
  await webview.emit({ type: "setup.installTarget", targetId: "claude" });

  assert.deepEqual(calls, ["scope:global", "install:claude"]);
  assert.match(webview.html, /Global/);
});

test("renderSetupHtml delegates nested clicks to the nearest action target", () => {
  const html = renderSetupHtml(createViewModel());
  const actionButton = new FakeElement({
    action: "install-target",
    targetId: "claude",
  });
  const nestedLabel = new FakeElement({}, actionButton);

  const { messages } = runSetupScript({
    html,
    clickTarget: nestedLabel,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
    {
      type: "setup.installTarget",
      targetId: "claude",
    },
  ]);
});
