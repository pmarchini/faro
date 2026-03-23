import React from "react";

import { AppShell } from "./components/app-shell.ts";
import { PathDeleteConfirmation } from "./modals/path-delete-confirmation.ts";
import { SetupInstallConfirmation } from "./modals/setup-install-confirmation.ts";
import type { MainViewBridge, MainWebviewViewModel } from "./main-view-contract.ts";
import { h } from "./react-helpers.ts";
import { HomeRoute } from "./routes/home-route.ts";
import { PathRoute } from "./routes/path-route.ts";
import { SetupRoute } from "./routes/setup-route.ts";

type MainViewAppProps = {
  viewModel: MainWebviewViewModel;
  bridge?: MainViewBridge;
  interactive?: boolean;
};

export function MainViewApp({
  viewModel,
  bridge,
  interactive = false,
}: MainViewAppProps): React.ReactElement {
  const hasPendingDeleteConfirmation = viewModel.selectedRoute === "path" &&
    Boolean(viewModel.pendingPathDeleteConfirmation);
  const hasPendingSetupConfirmation = viewModel.selectedRoute === "setup" &&
    Boolean(viewModel.setup.pendingInstallConfirmation);

  return h(
    React.Fragment,
    null,
    h(
      "main",
      null,
      h(AppShell, { viewModel, bridge, interactive }),
      renderSelectedRoute(viewModel, bridge, interactive),
    ),
    hasPendingDeleteConfirmation
      ? h(PathDeleteConfirmation, { viewModel, bridge, interactive })
      : null,
    hasPendingSetupConfirmation
      ? h(SetupInstallConfirmation, { viewModel: viewModel.setup, bridge, interactive })
      : null,
  );
}

function renderSelectedRoute(
  viewModel: MainWebviewViewModel,
  bridge: MainViewBridge | undefined,
  interactive: boolean,
): React.ReactElement {
  if (viewModel.selectedRoute === "home") {
    return h(HomeRoute, { viewModel: viewModel.home, bridge, interactive });
  }

  if (viewModel.selectedRoute === "setup") {
    return h(SetupRoute, { viewModel: viewModel.setup, bridge, interactive });
  }

  return h(PathRoute, { viewModel: viewModel.path, bridge, interactive });
}
