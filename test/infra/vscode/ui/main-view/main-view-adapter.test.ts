import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildHomeViewModel } from "../../../../../src/app/views/home-view-model.ts";
import { buildNavigatorViewModel } from "../../../../../src/app/views/navigator-view-model.ts";
import { buildSetupViewModel } from "../../../../../src/app/views/setup-view-model.ts";
import {
  createMainWebviewAdapter,
  renderMainHtml,
} from "../../../../../src/infra/vscode/ui/main-view/main-view-adapter.ts";
import { mainMessage } from "../../../../../src/infra/vscode/ui/main-view/main-view-contract.ts";
import * as fixtures from "../../../../core/fixtures.ts";

function createMainViewModel(
  route: "home" | "path" | "setup" = "home",
  options: {
    pendingPathDeleteConfirmation?: {
      pathId: string;
      pathTitle: string;
    };
    setupLoading?: boolean;
    pendingInstallConfirmation?: {
      targetId: "claude" | "copilotInstructions" | "copilotAgent" | "codexSkill";
    };
  } = {},
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
    pendingPathDeleteConfirmation: options.pendingPathDeleteConfirmation,
    setup: buildSetupViewModel({
      scope: "local",
      isLoading: options.setupLoading ?? false,
      targets: [
        { id: "claude", status: "missing" },
        { id: "copilotInstructions", status: "installed" },
        { id: "copilotAgent", status: "missing" },
        { id: "codexSkill", status: "missing" },
      ],
      pendingInstallConfirmation: options.pendingInstallConfirmation,
    }),
  };
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
  return fileURLToPath(new URL(`./__snapshots__/main-view-adapter/${name}.html`, import.meta.url));
}

function assertMatchesSnapshot(html: string, name: string): void {
  assert.equal(
    normalizeSnapshotHtml(extractMainContent(html)),
    readFileSync(snapshotPath(name), "utf8").trimEnd(),
  );
}

function createAdapterWebview() {
  let listener: ((message: unknown) => void | Promise<void>) | null = null;

  return {
    html: "",
    onDidReceiveMessage(nextListener: (message: unknown) => void | Promise<void>) {
      listener = nextListener;
      return {
        dispose() {
          listener = null;
        },
      };
    },
    async emit(message: unknown) {
      await listener?.(message);
    },
  };
}

test("renderMainHtml renders the home launcher", () => {
  const html = renderMainHtml(createMainViewModel("home"));

  assert.match(html, /Resume Current Path/);
  assert.match(html, /Open Setup/);
  assert.match(html, /<svg[\s\S]*viewBox="0 0 256 256"/);
  assert.doesNotMatch(html, /Main Page/);
  assert.doesNotMatch(html, /Checking integrations/);
});

test("createMainWebviewAdapter ignores unknown messages", async () => {
  const webview = createAdapterWebview();
  const calls: string[] = [];
  const adapter = createMainWebviewAdapter({
    webview,
    getViewModel: () => createMainViewModel("home"),
    onOpenHome: async () => {
      calls.push("openHome");
    },
    onOpenPath: async () => {
      calls.push("openPath");
    },
    onOpenSetup: async () => {
      calls.push("openSetup");
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
    onRequestDeletePath: async () => {
      calls.push("requestDeletePath");
    },
    onCancelDeletePath: async () => {
      calls.push("cancelDeletePath");
    },
    onConfirmDeletePath: async () => {
      calls.push("confirmDeletePath");
    },
    onSelectBeacon: async () => {
      calls.push("selectBeacon");
    },
    onSetupSelectScope: async () => {
      calls.push("setupSetScope");
    },
    onSetupRequestInstallTarget: async () => {
      calls.push("setupRequestInstallTarget");
    },
    onSetupCancelInstallTarget: async () => {
      calls.push("setupCancelInstallTarget");
    },
    onSetupConfirmInstallTarget: async () => {
      calls.push("setupConfirmInstallTarget");
    },
  });

  await webview.emit({ type: "main.unknown" });

  assert.deepEqual(calls, []);
  assert.equal(webview.html, "");

  adapter.dispose();
});

test("createMainWebviewAdapter ignores non-object messages from the webview boundary", async () => {
  const webview = createAdapterWebview();
  const adapter = createMainWebviewAdapter({
    webview,
    getViewModel: () => createMainViewModel("home"),
    onOpenHome: async () => {},
    onOpenPath: async () => {},
    onOpenSetup: async () => {},
    onPrevious: async () => {},
    onNext: async () => {},
    onReveal: async () => {},
    onRequestDeletePath: async () => {},
    onCancelDeletePath: async () => {},
    onConfirmDeletePath: async () => {},
    onSelectBeacon: async () => {},
    onSetupSelectScope: async () => {},
    onSetupRequestInstallTarget: async () => {},
    onSetupCancelInstallTarget: async () => {},
    onSetupConfirmInstallTarget: async () => {},
  });

  await assert.doesNotReject(async () => {
    await webview.emit(null);
  });

  assert.equal(webview.html, "");

  adapter.dispose();
});

test("createMainWebviewAdapter exposes render errors on the adapter object", () => {
  const webview = {
    onDidReceiveMessage() {
      return {
        dispose() {},
      };
    },
    set html(_value: string) {
      throw new Error("render failed");
    },
  };
  const adapter = createMainWebviewAdapter({
    webview,
    getViewModel: () => createMainViewModel("home"),
    onOpenHome: async () => {},
    onOpenPath: async () => {},
    onOpenSetup: async () => {},
    onPrevious: async () => {},
    onNext: async () => {},
    onReveal: async () => {},
    onRequestDeletePath: async () => {},
    onCancelDeletePath: async () => {},
    onConfirmDeletePath: async () => {},
    onSelectBeacon: async () => {},
    onSetupSelectScope: async () => {},
    onSetupRequestInstallTarget: async () => {},
    onSetupCancelInstallTarget: async () => {},
    onSetupConfirmInstallTarget: async () => {},
  });

  assert.equal(adapter.render(), false);
  assert.deepEqual(adapter.lastError, {
    kind: "render",
    cause: new Error("render failed"),
  });

  adapter.dispose();
});

test("createMainWebviewAdapter exposes message handling errors on the adapter object", async () => {
  const webview = createAdapterWebview();
  const adapter = createMainWebviewAdapter({
    webview,
    getViewModel: () => createMainViewModel("home"),
    onOpenHome: async () => {
      throw new Error("open home failed");
    },
    onOpenPath: async () => {},
    onOpenSetup: async () => {},
    onPrevious: async () => {},
    onNext: async () => {},
    onReveal: async () => {},
    onRequestDeletePath: async () => {},
    onCancelDeletePath: async () => {},
    onConfirmDeletePath: async () => {},
    onSelectBeacon: async () => {},
    onSetupSelectScope: async () => {},
    onSetupRequestInstallTarget: async () => {},
    onSetupCancelInstallTarget: async () => {},
    onSetupConfirmInstallTarget: async () => {},
  });

  await assert.doesNotReject(async () => {
    await webview.emit(mainMessage.openHome());
  });

  assert.deepEqual(adapter.lastError, {
    kind: "message",
    message: mainMessage.openHome(),
    cause: new Error("open home failed"),
  });
  assert.equal(webview.html, "");

  adapter.dispose();
});

test("renderMainHtml renders the path route controls", () => {
  const html = renderMainHtml(createMainViewModel("path"));

  assert.match(html, /Prev/);
  assert.match(html, /Reveal/);
  assert.match(html, /Next/);
  assert.match(html, /Auth Flow/);
  assert.match(html, /Delete Path/);
  assert.match(
    html,
    /<button[\s\S]*data-action="request-delete-path"[\s\S]*data-variant="danger"[\s\S]*Delete Path[\s\S]*<\/button>/,
  );
});

test("renderMainHtml shows the position pill in Current Beacon, not Current Path", () => {
  const html = renderMainHtml(createMainViewModel("path"));
  const currentPathSection = html.match(
    /<section class="panel">\s*<div class="path-meta">[\s\S]*?<span class="eyebrow">Current Path<\/span>[\s\S]*?<\/section>/,
  );
  const currentBeaconSection = html.match(
    /<section class="panel">\s*<div class="path-meta">[\s\S]*?<span class="eyebrow">Current Beacon<\/span>[\s\S]*?<\/section>/,
  );

  assert.ok(currentPathSection, "expected Current Path section");
  assert.ok(currentBeaconSection, "expected Current Beacon section");
  assert.doesNotMatch(currentPathSection[0], /<span class="pill">1 of 2<\/span>/);
  assert.match(currentBeaconSection[0], /<span class="pill">1 of 2<\/span>/);
});

test("renderMainHtml renders the path delete confirmation controls", () => {
  const html = renderMainHtml(
    createMainViewModel("path", {
      pendingPathDeleteConfirmation: {
        pathId: "auth-flow",
        pathTitle: "Auth Flow",
      },
    }),
  );

  assert.match(html, /Delete Path/);
  assert.match(html, /Delete current path\?/);
  assert.match(html, /Auth Flow/);
  assert.match(html, /data-action="request-delete-path"/);
  assert.match(html, /data-action="confirm-delete-path"/);
  assert.match(html, /data-action="cancel-delete-path"/);
});

test("renderMainHtml renders the setup install trigger", () => {
  const html = renderMainHtml(createMainViewModel("setup"));

  assert.match(html, /data-action="setup-install-target"/);
  assert.match(html, /data-target-id="claude"/);
});

test("renderMainHtml renders the setup confirmation modal controls", () => {
  const html = renderMainHtml(
    createMainViewModel("setup", {
      pendingInstallConfirmation: {
        targetId: "copilotInstructions",
      },
    }),
  );

  assert.match(html, /Confirm install/);
  assert.match(html, /Confirm Reinstall/);
  assert.match(html, /data-action="setup-confirm-install-target"/);
  assert.match(html, /data-action="setup-cancel-install-target"/);
});

test("renderMainHtml renders the setup modal outside the blurred main shell", () => {
  const html = renderMainHtml(
    createMainViewModel("setup", {
      pendingInstallConfirmation: {
        targetId: "claude",
      },
    }),
  );

  assert.match(html, /<body[^>]*data-modal-open="true"/);
  assert.match(html, /<main>/);
  assert.match(html, /<\/main>\s*<section class="modal-layer" aria-label="Confirm install">/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
});

test("renderMainHtml matches the home route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("home"));

  assertMatchesSnapshot(html, "home.route");
});

test("renderMainHtml matches the path route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("path"));

  assertMatchesSnapshot(html, "path.route");
});

test("renderMainHtml matches the setup route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("setup"));

  assertMatchesSnapshot(html, "setup.route");
});

test("renderMainHtml matches the loading setup route snapshot", (t) => {
  const html = renderMainHtml(createMainViewModel("setup", { setupLoading: true }));

  assertMatchesSnapshot(html, "setup-loading.route");
});

test("renderMainHtml does not emit the legacy inline bridge when bundles are unavailable", () => {
  const html = renderMainHtml(createMainViewModel("home"));

  assert.doesNotMatch(html, /acquireVsCodeApi\(\)/);
  assert.doesNotMatch(html, /document\.addEventListener\("click"/);
});

test("renderMainHtml emits a bootstrap payload for the bundled runtime when asset URIs are provided", () => {
  const html = renderMainHtml(createMainViewModel("home"), {
    cssUri: "webview:/main/index.css",
    jsUri: "webview:/main/index.js",
  });

  assert.match(html, /<div id="faro-main-root">/);
  assert.match(html, /<script id="faro-main-bootstrap" type="application\/json">/);
  assert.match(html, /"selectedRoute":"home"/);
  assert.match(html, /<script type="module" src="webview:\/main\/index\.js"><\/script>/);
  assert.doesNotMatch(html, /acquireVsCodeApi\(\)/);
});
