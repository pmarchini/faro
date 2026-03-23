import assert from "node:assert/strict";
import test from "node:test";

import React from "react";

import { buildHomeViewModel } from "../../../../../src/app/views/home-view-model.ts";
import { buildNavigatorViewModel } from "../../../../../src/app/views/navigator-view-model.ts";
import { buildSetupViewModel } from "../../../../../src/app/views/setup-view-model.ts";
import { MainViewApp } from "../../../../../src/infra/vscode/ui/main-view/main-view-app.ts";
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

test("MainViewApp emits the existing setup intent from the home launcher", async () => {
  const dom = installDomTestEnvironment();
  const messages: MainMessage[] = [];

  try {
    const { render, screen, cleanup } = await import("@testing-library/react");

    render(
      React.createElement(MainViewApp, {
        viewModel: createMainViewModel("home"),
        interactive: true,
        bridge: {
          postMessage(message: MainMessage) {
            messages.push(message);
          },
        },
      }),
    );

    screen.getByText("Open Setup").click();

    assert.deepEqual(messages, [mainMessage.openSetup()]);
    cleanup();
  } finally {
    dom.dispose();
  }
});
