import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
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

function createMainViewModel(
  route: "home" | "path" | "setup" = "home",
  options: { setupLoading?: boolean } = {},
) {
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
      isLoading: options.setupLoading ?? false,
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

function extractMainContent(html: string): string {
  const mainMatch = html.match(/<main>([\s\S]*?)<\/main>/);

  assert.ok(mainMatch, "expected main html to contain a main element");

  return mainMatch[1];
}

function normalizeSnapshotHtml(html: string): string {
  return html
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line.length > 0 || lines[index - 1] !== "")
    .join("\n")
    .trim();
}

function snapshotPath(name: string): string {
  return fileURLToPath(new URL(`./__snapshots__/main-webview/${name}.html`, import.meta.url));
}

test("renderMainHtml renders the home launcher", () => {
  const html = renderMainHtml(createMainViewModel("home"));

  assert.match(html, /Resume Current Path/);
  assert.match(html, /Open Setup/);
  assert.match(html, /<svg[\s\S]*viewBox="0 0 256 256"/);
  assert.doesNotMatch(html, /Main Page/);
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

test("renderMainHtml delegates nested clicks inside the full beacon card", () => {
  const html = renderMainHtml(createMainViewModel("path"));
  const button = new FakeElement({
    action: "select-beacon",
    pathId: "auth-flow",
    beaconId: "b1",
  });
  const nested = new FakeElement({}, button);

  const messages = runScript({ html, clickTarget: nested });

  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
    { type: "main.selectBeacon", pathId: "auth-flow", beaconId: "b1" },
  ]);
});

test("renderMainHtml matches the home route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("home"));

  t.assert.fileSnapshot(
    normalizeSnapshotHtml(extractMainContent(html)),
    snapshotPath("home.route"),
  );
});

test("renderMainHtml matches the path route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("path"));

  t.assert.fileSnapshot(
    normalizeSnapshotHtml(extractMainContent(html)),
    snapshotPath("path.route"),
  );
});

test("renderMainHtml matches the setup route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("setup"));

  t.assert.fileSnapshot(
    normalizeSnapshotHtml(extractMainContent(html)),
    snapshotPath("setup.route"),
  );
});

test("renderMainHtml matches the loading setup route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("setup", { setupLoading: true }));

  t.assert.fileSnapshot(
    normalizeSnapshotHtml(extractMainContent(html)),
    snapshotPath("setup-loading.route"),
  );
});
