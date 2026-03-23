import React from "react";

import { createActionProps } from "../components/action-props.ts";
import { FaroLogo } from "../components/faro-logo.ts";
import { mainMessage, type MainViewBridge } from "../main-view-contract.ts";
import { h } from "../react-helpers.ts";
import type { HomeViewModel } from "../../../../../app/views/home-view-model.ts";

export function HomeRoute({
  viewModel,
  bridge,
  interactive,
}: {
  viewModel: HomeViewModel;
  bridge?: MainViewBridge;
  interactive: boolean;
}): React.ReactElement {
  return h(
    React.Fragment,
    null,
    h(
      "section",
      { className: "panel home-hero" },
      h("span", { className: "eyebrow" }, "Faro Home"),
      h(FaroLogo),
      h("h2", { className: "section-title" }, viewModel.title),
      h("p", { className: "body-copy" }, viewModel.message),
    ),
    h(
      "section",
      { className: "panel" },
      h("span", { className: "eyebrow" }, "Start Here"),
      h(
        "div",
        { className: "home-actions" },
        h(
          "button",
          {
            className: "home-card",
            ...createActionProps(
              {
                action: "open-path",
                onClickMessage: mainMessage.openPath(),
              },
              bridge,
              interactive,
            ),
          },
          h(
            "div",
            { className: "home-card-top" },
            h("h3", { className: "home-card-title" }, viewModel.resumeLabel),
            h("span", { className: "badge" }, "1"),
          ),
          h("p", { className: "body-copy" }, viewModel.currentPathSummary),
        ),
        h(
          "button",
          {
            className: "home-card",
            ...createActionProps(
              {
                action: "open-setup",
                onClickMessage: mainMessage.openSetup(),
              },
              bridge,
              interactive,
            ),
          },
          h(
            "div",
            { className: "home-card-top" },
            h("h3", { className: "home-card-title" }, viewModel.setupLabel),
            h("span", { className: "badge" }, "S"),
          ),
          h("p", { className: "body-copy" }, viewModel.setupSummary),
          h("div", { className: "home-card-action" }, "Inspect local and global integrations"),
        ),
      ),
    ),
  );
}
