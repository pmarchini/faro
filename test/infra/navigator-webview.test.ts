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
  | { type: "navigator.selectBeacon"; pathId: string; beaconId: string }
  | { type: "unknown" };

function createReadyViewModel(
  overrides: Partial<Extract<NavigatorViewModel, { state: "ready" }>> = {},
): NavigatorViewModel {
  return {
    state: "ready",
    pathId: "auth-flow",
    pathTitle: "Auth Flow",
    goal: "Trace authentication",
    currentStepNumber: 1,
    beaconCount: 2,
    beaconId: "b1",
    beaconTitle: "Entry route",
    summary: "The request enters here.",
    explanation: "Headers are normalized here.",
    tags: ["entrypoint"],
    positionLabel: "1 of 2",
    canGoPrevious: false,
    canGoNext: true,
    beacons: [
      {
        id: "b1",
        title: "Entry route",
        isCurrent: true,
      },
      {
        id: "b2",
        title: "Session load",
        isCurrent: false,
      },
    ],
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
  assert.match(html, /Active Path/);
  assert.match(html, /Entry route/);
  assert.match(html, /Trace authentication/);
  assert.match(html, /Headers are normalized here\./);
  assert.match(html, /1 of 2/);
  assert.match(html, /Current Beacon/);
  assert.match(html, /Beacon Sequence/);
  assert.match(html, />Prev</);
  assert.match(html, />Reveal</);
  assert.match(html, />Next</);
  assert.match(html, /Entry route/);
  assert.match(html, /Session load/);
  assert.match(html, /data-action="select-beacon"/);
  assert.match(html, /data-role="beacon-list"/);
  assert.match(html, /data-scrollable="true"/);
  assert.doesNotMatch(html, /Saved Paths/);
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
    onSelectBeacon: async () => {},
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
    onSelectBeacon: async () => {},
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
    onSelectBeacon: async () => {},
  });

  adapter.render();
  await webview.emit({ type: "navigator.next" });
  await webview.emit({ type: "navigator.reveal" });

  assert.deepEqual(calls, ["next", "reveal"]);
});

test("adapter routes beacon selection through the callback and rerenders", async () => {
  const webview = createFakeWebview();
  const calls: string[] = [];
  let renderCount = 0;
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => {
      renderCount += 1;
      return createReadyViewModel();
    },
    onPrevious: async () => {},
    onNext: async () => {},
    onReveal: async () => {},
    onSelectBeacon: async (pathId, beaconId) => {
      calls.push(`${pathId}:${beaconId}`);
    },
  });

  adapter.render();
  await webview.emit({ type: "navigator.selectBeacon", pathId: "auth-flow", beaconId: "b2" });

  assert.deepEqual(calls, ["auth-flow:b2"]);
  assert.equal(renderCount, 2);
});

test("renderNavigatorHtml escapes hostile content", () => {
  const html = renderNavigatorHtml(
    createReadyViewModel({
      pathTitle: `<Auth>`,
      beaconTitle: `"Entry"`,
      summary: `<script>alert(1)</script>`,
      explanation: `a & b`,
      tags: [`<tag>`],
      beacons: [
        {
          id: "b1",
          title: `<current>`,
          isCurrent: true,
        },
      ],
    }),
  );

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;Auth&gt;/);
  assert.match(html, /&quot;Entry&quot;/);
  assert.match(html, /a &amp; b/);
  assert.match(html, /&lt;tag&gt;/);
  assert.match(html, /&lt;current&gt;/);
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
    onSelectBeacon: async (pathId, beaconId) => {
      calls.push(`select:${pathId}:${beaconId}`);
    },
  });

  adapter.render();
  await webview.emit({ type: "unknown" });

  assert.deepEqual(calls, []);
});
