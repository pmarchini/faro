import React from "react";

import { createActionProps } from "../components/action-props.ts";
import {
  mainMessage,
  type MainViewBridge,
  type MainWebviewViewModel,
} from "../main-view-contract.ts";
import { h } from "../react-helpers.ts";

export function PathDeleteConfirmation({
  viewModel,
  bridge,
  interactive,
}: {
  viewModel: MainWebviewViewModel;
  bridge?: MainViewBridge;
  interactive: boolean;
}): React.ReactElement | null {
  const confirmation = viewModel.pendingPathDeleteConfirmation;
  if (!confirmation) {
    return null;
  }

  return h(
    "section",
    { className: "modal-layer", "aria-label": "Delete path confirmation" },
    h(
      "section",
      {
        className: "panel confirmation",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "delete-path-title",
      },
      h(
        "div",
        { className: "confirmation-header" },
        h("span", { className: "eyebrow" }, "Delete path"),
      ),
      h("h3", { className: "row-title", id: "delete-path-title" }, "Delete current path?"),
      h(
        "p",
        { className: "body-copy" },
        `Remove ${confirmation.pathTitle} from the workspace state. Faro will select the next available path automatically.`,
      ),
      h(
        "div",
        { className: "confirmation-meta" },
        h("span", { className: "pill" }, `Path: ${confirmation.pathTitle}`),
      ),
      h(
        "section",
        { className: "confirmation-warning" },
        h("span", { className: "eyebrow" }, "Destructive action"),
        h("p", { className: "body-copy" }, "This path disappears from the current UI state immediately."),
      ),
      h(
        "div",
        { className: "confirmation-actions" },
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              { action: "cancel-delete-path", onClickMessage: mainMessage.cancelDeletePath() },
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
                action: "confirm-delete-path",
                onClickMessage: mainMessage.confirmDeletePath(confirmation.pathId),
                pathId: confirmation.pathId,
              },
              bridge,
              interactive,
            ),
            "data-variant": "danger",
          },
          "Delete Path",
        ),
      ),
    ),
  );
}
