import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { buildHomeViewModel } from "../../src/app/views/home-view-model.ts";
import { buildNavigatorViewModel } from "../../src/app/views/navigator-view-model.ts";
import { buildSetupViewModel } from "../../src/app/views/setup-view-model.ts";
import { renderMainHtml } from "../../src/infra/vscode/main-webview.ts";
import * as fixtures from "../core/fixtures.ts";

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

function createMainViewModel(route: "home" | "path" | "setup" = "home") {
  const document = fixtures.createDocument();

  return {
    selectedRoute: route,
    routes: [
      { id: "home" as const, label: "Home", isSelected: route === "home" },
      { id: "path" as const, label: "Path", isSelected: route === "path" },
      { id: "setup" as const, label: "Setup", isSelected: route === "setup" },
    ],
    home: buildHomeViewModel(document),
    path: buildNavigatorViewModel(document, { showWelcome: false }),
    setup: buildSetupViewModel({
      scope: "local",
      isLoading: false,
      targets: [
        { id: "claude", status: "missing" },
        { id: "copilotInstructions", status: "installed" },
        { id: "copilotAgent", status: "missing" },
        { id: "codexSkill", status: "missing" },
      ],
    }),
  };
}

function runScript({
  html,
  clickTarget,
}: {
  html: string;
  clickTarget: FakeElement;
}): unknown[] {
  const messages: unknown[] = [];
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(scriptMatch, "expected main html to include a script block");

  let clickListener: ((event: { target: FakeElement }) => void) | null = null;

  vm.runInNewContext(scriptMatch[1], {
    acquireVsCodeApi() {
      return {
        postMessage(message: unknown) {
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
  });

  const invokeClick: (event: { target: FakeElement }) => void =
    clickListener ??
    (() => {
      throw new Error("expected a click listener");
    });
  invokeClick({ target: clickTarget });

  return messages;
}

test("renderMainHtml renders the home launcher", () => {
  const html = renderMainHtml(createMainViewModel("home"));

  assert.match(html, /Resume Current Path/);
  assert.match(html, /Open Setup/);
  assert.doesNotMatch(html, /Checking integrations/);
});

test("renderMainHtml renders the path route controls", () => {
  const html = renderMainHtml(createMainViewModel("path"));

  assert.match(html, /Prev/);
  assert.match(html, /Reveal/);
  assert.match(html, /Next/);
  assert.match(html, /Auth Flow/);
});

test("renderMainHtml delegates nested clicks to route actions", () => {
  const html = renderMainHtml(createMainViewModel("home"));
  const button = new FakeElement({ action: "open-setup" });
  const nested = new FakeElement({}, button);

  const messages = runScript({ html, clickTarget: nested });

  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [{ type: "main.openSetup" }]);
});
