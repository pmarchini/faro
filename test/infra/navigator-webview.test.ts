import assert from "node:assert/strict";
import test from "node:test";

import type { NavigatorViewModel } from "../../src/app/views/navigator-view-model.ts";
import {
  createNavigatorWebviewAdapter,
  renderNavigatorHtml,
} from "../../src/infra/vscode/navigator-webview.ts";

type WebviewMessage =
  | { type: "navigator.previous" }
  | { type: "navigator.next" }
  | { type: "navigator.reveal" }
  | { type: "unknown" };

function createReadyViewModel(
  overrides: Partial<Extract<NavigatorViewModel, { state: "ready" }>> = {},
): NavigatorViewModel {
  return {
    state: "ready",
    pathId: "auth-flow",
    pathTitle: "Auth Flow",
    goal: "Trace authentication",
    beaconId: "b1",
    beaconTitle: "Entry route",
    summary: "The request enters here.",
    explanation: "Headers are normalized here.",
    tags: ["entrypoint"],
    positionLabel: "1 of 2",
    canGoPrevious: false,
    canGoNext: true,
    ...overrides,
  };
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

test("renderNavigatorHtml renders the empty state", () => {
  const html = renderNavigatorHtml({
    state: "empty",
    title: "No active path",
    message: "Ask an agent to create a Faro path to get started.",
    canGoPrevious: false,
    canGoNext: false,
  });

  assert.match(html, /No active path/);
  assert.match(html, /Ask an agent to create a Faro path/);
  assert.match(html, /disabled/);
});

test("renderNavigatorHtml renders the ready state", () => {
  const html = renderNavigatorHtml(createReadyViewModel());

  assert.match(html, /Auth Flow/);
  assert.match(html, /Entry route/);
  assert.match(html, /Headers are normalized here\./);
  assert.match(html, /1 of 2/);
  assert.match(html, /data-action="previous"/);
  assert.match(html, /data-action="reveal"/);
  assert.match(html, /data-action="next"/);
  assert.match(html, /vscode\.postMessage/);
});

test("adapter renders initial state into the webview", () => {
  const webview = createFakeWebview();
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => createReadyViewModel(),
    onPrevious: async () => {},
    onNext: async () => {},
    onReveal: async () => {},
  });

  adapter.render();

  assert.match(webview.html, /Entry route/);
});

test("adapter routes previous messages through the callback and rerenders", async () => {
  const webview = createFakeWebview();
  const calls: string[] = [];
  let renderCount = 0;
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => {
      renderCount += 1;
      return createReadyViewModel();
    },
    onPrevious: async () => {
      calls.push("previous");
    },
    onNext: async () => {},
    onReveal: async () => {},
  });

  adapter.render();
  await webview.emit({ type: "navigator.previous" });

  assert.deepEqual(calls, ["previous"]);
  assert.equal(renderCount, 2);
});

test("adapter routes next and reveal messages through their callbacks", async () => {
  const webview = createFakeWebview();
  const calls: string[] = [];
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => createReadyViewModel(),
    onPrevious: async () => {},
    onNext: async () => {
      calls.push("next");
    },
    onReveal: async () => {
      calls.push("reveal");
    },
  });

  adapter.render();
  await webview.emit({ type: "navigator.next" });
  await webview.emit({ type: "navigator.reveal" });

  assert.deepEqual(calls, ["next", "reveal"]);
});

test("renderNavigatorHtml escapes hostile content", () => {
  const html = renderNavigatorHtml(
    createReadyViewModel({
      pathTitle: `<Auth>`,
      beaconTitle: `"Entry"`,
      summary: `<script>alert(1)</script>`,
      explanation: `a & b`,
      tags: [`<tag>`],
    }),
  );

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;Auth&gt;/);
  assert.match(html, /&quot;Entry&quot;/);
  assert.match(html, /a &amp; b/);
  assert.match(html, /&lt;tag&gt;/);
});

test("adapter ignores unknown messages", async () => {
  const webview = createFakeWebview();
  const calls: string[] = [];
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => createReadyViewModel(),
    onPrevious: async () => {
      calls.push("previous");
    },
    onNext: async () => {
      calls.push("next");
    },
    onReveal: async () => {
      calls.push("reveal");
    },
  });

  adapter.render();
  await webview.emit({ type: "unknown" });

  assert.deepEqual(calls, []);
});
