import React from "react";

import { createActionProps } from "./action-props.ts";
import {
  mainMessage,
  type MainViewBridge,
  type MainWebviewViewModel,
} from "../main-view-contract.ts";
import { h } from "../react-helpers.ts";

export function AppShell({
  viewModel,
  bridge,
  interactive,
}: {
  viewModel: MainWebviewViewModel;
  bridge?: MainViewBridge;
  interactive: boolean;
}): React.ReactElement {
  return h(
    "section",
    { className: "shell" },
    h("span", { className: "eyebrow" }, "Faro"),
    h("h1", { className: "title" }, "One sidebar, three focused destinations."),
    h(
      "p",
      { className: "body-copy" },
      "Move between home, path reading, and setup without adding more views to the VS Code activity bar.",
    ),
    h(
      "div",
      { className: "nav" },
      viewModel.routes.map((route) =>
        h(
          "button",
          {
            key: route.id,
            className: "nav-button",
            "data-selected": route.isSelected ? "true" : "false",
            ...createActionProps({
              action: `open-${route.id}`,
              onClickMessage: route.id === "home"
                ? mainMessage.openHome()
                : route.id === "path"
                ? mainMessage.openPath()
                : mainMessage.openSetup(),
            }, bridge, interactive),
          },
          route.label,
        )
      ),
    ),
  );
}
