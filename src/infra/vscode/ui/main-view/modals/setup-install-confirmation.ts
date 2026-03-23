import React from "react";

import type { SetupViewModel } from "../../../../../app/views/setup-view-model.ts";
import { createActionProps } from "../components/action-props.ts";
import { mainMessage, type MainViewBridge } from "../main-view-contract.ts";
import { h } from "../react-helpers.ts";

export function SetupInstallConfirmation({
  viewModel,
  bridge,
  interactive,
}: {
  viewModel: SetupViewModel;
  bridge?: MainViewBridge;
  interactive: boolean;
}): React.ReactElement | null {
  const confirmation = viewModel.pendingInstallConfirmation;
  if (!confirmation) {
    return null;
  }

  return h(
    "section",
    { className: "modal-layer", "aria-label": "Confirm install" },
    h(
      "section",
      {
        className: "panel confirmation",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "setup-confirmation-title",
      },
      h(
        "div",
        { className: "confirmation-header" },
        h("span", { className: "eyebrow" }, "Confirm install"),
      ),
      h("h3", { className: "row-title", id: "setup-confirmation-title" }, confirmation.title),
      h("p", { className: "body-copy" }, confirmation.description),
      h(
        "div",
        { className: "confirmation-meta" },
        h("span", { className: "pill" }, `Target: ${confirmation.targetLabel}`),
        h("span", { className: "pill" }, `Scope: ${confirmation.scopeLabel}`),
      ),
      h(
        "section",
        { className: "confirmation-warning" },
        h("span", { className: "eyebrow" }, confirmation.warningTitle),
        h("p", { className: "body-copy" }, confirmation.warningMessage),
      ),
      h(
        "div",
        { className: "confirmation-actions" },
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              {
                action: "setup-cancel-install-target",
                onClickMessage: mainMessage.setupCancelInstallTarget(),
              },
              bridge,
              interactive,
            ),
            "data-variant": "secondary",
          },
          "Cancel",
        ),
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              {
                action: "setup-confirm-install-target",
                onClickMessage: mainMessage.setupConfirmInstallTarget(confirmation.targetId),
                targetId: confirmation.targetId,
              },
              bridge,
              interactive,
            ),
          },
          confirmation.confirmLabel,
        ),
      ),
    ),
  );
}
