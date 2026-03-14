import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import type { NavigatorViewModel } from "../../src/app/views/navigator-view-model.ts";
import {
  createNavigatorWebviewAdapter,
  renderNavigatorHtml,
} from "../../src/infra/vscode/navigator-webview.ts";

type WebviewMessage =
  | { type: "navigator.primaryAction" }
  | { type: "navigator.previous" }
  | { type: "navigator.next" }
  | { type: "navigator.reveal" }
  | { type: "navigator.selectBeacon"; pathId: string; beaconId: string }
  | { type: "unknown" };

class FakeElement {
  dataset: Record<string, string>;
  parentElement: FakeElement | null;
  scrollCalls: Array<Record<string, string>>;

  constructor(dataset: Record<string, string> = {}, parentElement: FakeElement | null = null) {
    this.dataset = dataset;
    this.parentElement = parentElement;
    this.scrollCalls = [];
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

  scrollIntoView(options: Record<string, string>) {
    this.scrollCalls.push(options);
  }
}

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
        summary: "The request enters here.",
        stepNumber: 1,
        isCurrent: true,
      },
      {
        id: "b2",
        title: "Session load",
        summary: "Session state is restored here.",
        stepNumber: 2,
        isCurrent: false,
      },
    ],
    ...overrides,
  };
}

function createWelcomeViewModel(
  overrides: Partial<Extract<NavigatorViewModel, { state: "welcome" }>> = {},
): NavigatorViewModel {
  return {
    state: "welcome",
    title: "Welcome to Faro",
    message: "Turn codebase reasoning into a clear path of beacons you can follow inside VS Code.",
    primaryActionLabel: "Open Faro",
    canGoPrevious: false,
    canGoNext: false,
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

function runNavigatorScript({
  html,
  clickTarget,
  currentElement,
}: {
  html: string;
  clickTarget?: FakeElement;
  currentElement?: FakeElement | null;
}): { messages: WebviewMessage[] } {
  const messages: WebviewMessage[] = [];
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(scriptMatch, "expected navigator html to include a script block");

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
      querySelector(selector: string) {
        if (selector === '.beacon-button[data-current="true"]') {
          return currentElement ?? null;
        }

        return null;
      }
    },
    HTMLElement: FakeElement,
  };

  vm.runInNewContext(scriptMatch[1], context);
  if (clickTarget) {
    assert.ok(clickListener, "expected navigator html to register a click listener");
    if (!clickListener) {
      throw new Error("expected navigator html to register a click listener");
    }
    const listener = clickListener as (event: { target: FakeElement }) => void;
    listener({ target: clickTarget });
  }

  return { messages };
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

test("renderNavigatorHtml renders the welcome state", () => {
  const html = renderNavigatorHtml(createWelcomeViewModel());

  assert.match(html, /Welcome to Faro/);
  assert.match(html, /Open Faro/);
  assert.match(html, /data-action="primaryAction"/);
  assert.doesNotMatch(html, /Current Beacon/);
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
  assert.match(html, /Step 1/);
  assert.match(html, /Step 2/);
  assert.match(html, /Current step/);
  assert.match(html, /The request enters here\./);
  assert.match(html, /Session state is restored here\./);
  assert.match(html, />Prev</);
  assert.match(html, />Reveal</);
  assert.match(html, />Next</);
  assert.match(html, /Entry route/);
  assert.match(html, /Session load/);
  assert.match(html, /data-action="select-beacon"/);
  assert.match(html, /data-role="beacon-list"/);
  assert.match(html, /data-role="beacon-row"/);
  assert.match(html, /data-scrollable="true"/);
  assert.match(html, /data-current="true"/);
  assert.doesNotMatch(html, /Saved Paths/);
  assert.match(html, /vscode\.postMessage/);
});

test("adapter renders initial state into the webview", () => {
  const webview = createFakeWebview();
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => createReadyViewModel(),
    onPrimaryAction: async () => {},
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
    onPrimaryAction: async () => {},
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
    onPrimaryAction: async () => {},
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
    onPrimaryAction: async () => {},
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

test("adapter routes the welcome primary action through the callback and rerenders", async () => {
  const webview = createFakeWebview();
  const calls: string[] = [];
  let welcomeVisible = true;
  const adapter = createNavigatorWebviewAdapter({
    webview,
    getViewModel: () => (welcomeVisible ? createWelcomeViewModel() : createReadyViewModel()),
    onPrimaryAction: async () => {
      calls.push("open");
      welcomeVisible = false;
    },
    onPrevious: async () => {},
    onNext: async () => {},
    onReveal: async () => {},
    onSelectBeacon: async () => {},
  });

  adapter.render();
  await webview.emit({ type: "navigator.primaryAction" });

  assert.deepEqual(calls, ["open"]);
  assert.match(webview.html, /Current Beacon/);
  assert.doesNotMatch(webview.html, /Open Faro/);
});

test("renderNavigatorHtml delegates nested clicks inside a beacon card", () => {
  const html = renderNavigatorHtml(createReadyViewModel());
  const beaconButton = new FakeElement({
    action: "select-beacon",
    pathId: "auth-flow",
    beaconId: "b2",
  });
  const nestedTitle = new FakeElement({}, beaconButton);

  const { messages } = runNavigatorScript({ html, clickTarget: nestedTitle });

  assert.equal(messages.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(messages[0])), {
    type: "navigator.selectBeacon",
    pathId: "auth-flow",
    beaconId: "b2",
  });
});

test("renderNavigatorHtml scrolls the current beacon card into view", () => {
  const html = renderNavigatorHtml(createReadyViewModel());
  const currentBeacon = new FakeElement({ current: "true" });

  runNavigatorScript({
    html,
    currentElement: currentBeacon,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(currentBeacon.scrollCalls)), [
    {
      block: "center",
      inline: "nearest",
    },
  ]);
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
          summary: `<summary>`,
          stepNumber: 1,
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
    onPrimaryAction: async () => {
      calls.push("primary");
    },
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
