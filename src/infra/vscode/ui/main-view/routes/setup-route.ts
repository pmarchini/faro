import React from "react";

import type { SetupViewModel } from "../../../../../app/views/setup-view-model.ts";
import { createActionProps } from "../components/action-props.ts";
import { mainMessage, type MainViewBridge } from "../main-view-contract.ts";
import { h } from "../react-helpers.ts";

export function SetupRoute({
  viewModel,
  bridge,
  interactive,
}: {
  viewModel: SetupViewModel;
  bridge?: MainViewBridge;
  interactive: boolean;
}): React.ReactElement {
  return h(
    React.Fragment,
    null,
    h(
      "section",
      { className: "panel" },
      h("span", { className: "eyebrow" }, "Setup"),
      h("h2", { className: "section-title" }, viewModel.title),
      h("p", { className: "body-copy" }, viewModel.description),
      h(
        "div",
        { className: "scope-switch" },
        viewModel.scopeOptions.map((option) =>
          h(
            "button",
            {
              key: option.value,
              className: "scope-button",
              "data-selected": option.isSelected ? "true" : "false",
              ...createActionProps(
                {
                  action: "setup-set-scope",
                  onClickMessage: mainMessage.setupSetScope(option.value),
                  scope: option.value,
                },
                bridge,
                interactive,
              ),
            },
            option.label,
          )
        ),
      ),
      h("p", { className: "scope-hint" }, viewModel.scopeHint),
    ),
    viewModel.isLoading
      ? h(
        "section",
        { className: "panel" },
        h("p", { className: "body-copy" }, viewModel.loadingLabel),
      )
      : h(
        "section",
        { className: "list" },
        viewModel.items.map((item) =>
          h(
            "article",
            { key: item.id, className: "row" },
            h(
              "div",
              { className: "row-top" },
              h("h3", { className: "row-title" }, item.title),
              h("span", { className: "badge" }, item.status),
            ),
            h("p", { className: "body-copy" }, item.description),
            h(
              "div",
              { className: "row-footer" },
              h("span", { className: "muted" }, item.status),
              h(
                "button",
                {
                  className: "action-button",
                  ...createActionProps(
                    {
                      action: "setup-install-target",
                      onClickMessage: mainMessage.setupRequestInstallTarget(item.id),
                      targetId: item.id,
                    },
                    bridge,
                    interactive,
                  ),
                },
                item.actionLabel,
              ),
            ),
          )
        ),
      ),
    viewModel.feedback
      ? h(
        "section",
        { className: "panel" },
        h("p", { className: "feedback" }, viewModel.feedback.message),
      )
      : null,
  );
}
