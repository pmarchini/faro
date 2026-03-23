import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeViewModel } from "../../../../../src/app/views/home-view-model.ts";
import { buildNavigatorViewModel } from "../../../../../src/app/views/navigator-view-model.ts";
import { buildSetupViewModel } from "../../../../../src/app/views/setup-view-model.ts";
import { renderMainHtml } from "../../../../../src/infra/vscode/ui/main-view/main-view-adapter.ts";
import { hydrateMainView } from "../../../../../src/infra/vscode/ui/main-view/main-view-browser.ts";
import {
  mainMessage,
  type MainMessage,
} from "../../../../../src/infra/vscode/ui/main-view/main-view-contract.ts";
import * as fixtures from "../../../../core/fixtures.ts";
import { installDomTestEnvironment } from "./dom-test-environment.ts";

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

test("hydrateMainView wires the bundled browser runtime to the existing intent contract", async () => {
  const dom = installDomTestEnvironment();
  const messages: MainMessage[] = [];

  try {
    document.documentElement.innerHTML = renderMainHtml(createMainViewModel("home"), {
      cssUri: "webview:/main/index.css",
      jsUri: "webview:/main/index.js",
    });

    const runtime = hydrateMainView({
      acquireVsCodeApi() {
        return {
          postMessage(message: MainMessage) {
            messages.push(message);
          },
        };
      },
    });

    const launcher = document.querySelector('[data-action="open-setup"]');
    assert.ok(launcher instanceof HTMLElement);

    launcher.click();

    assert.deepEqual(messages, [mainMessage.openSetup()]);
    runtime.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    dom.dispose();
  }
});
