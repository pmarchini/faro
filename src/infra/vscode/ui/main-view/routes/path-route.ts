import React from "react";

import type {
  NavigatorBeaconListItem,
  NavigatorViewModel,
} from "../../../../../app/views/navigator-view-model.ts";
import { createActionProps } from "../components/action-props.ts";
import { mainMessage, type MainViewBridge } from "../main-view-contract.ts";
import { h } from "../react-helpers.ts";

export function PathRoute({
  viewModel,
  bridge,
  interactive,
}: {
  viewModel: NavigatorViewModel;
  bridge?: MainViewBridge;
  interactive: boolean;
}): React.ReactElement {
  if (viewModel.state === "empty" || viewModel.state === "welcome") {
    return h(
      "section",
      { className: "panel" },
      h("span", { className: "eyebrow" }, "Path"),
      h("h2", { className: "section-title" }, viewModel.title),
      h("p", { className: "body-copy" }, viewModel.message),
    );
  }

  return h(
    React.Fragment,
    null,
    h(
      "section",
      { className: "panel" },
      h(
        "div",
        { className: "path-meta" },
        h(
          "div",
          null,
          h("span", { className: "eyebrow" }, "Current Path"),
          h("h2", { className: "section-title" }, viewModel.pathTitle),
        ),
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              {
                action: "request-delete-path",
                onClickMessage: mainMessage.requestDeletePath(viewModel.pathId, viewModel.pathTitle),
                pathId: viewModel.pathId,
                pathTitle: viewModel.pathTitle,
              },
              bridge,
              interactive,
            ),
            "data-variant": "danger",
          },
          "Delete Path",
        ),
      ),
      h("p", { className: "body-copy" }, viewModel.goal),
    ),
    h(
      "section",
      { className: "panel" },
      h(
        "div",
        { className: "path-meta" },
        h("span", { className: "eyebrow" }, "Current Beacon"),
        h("span", { className: "pill" }, viewModel.positionLabel),
      ),
      h("h2", { className: "section-title" }, viewModel.beaconTitle),
      h("p", { className: "body-copy" }, viewModel.summary),
      h("p", { className: "body-copy" }, viewModel.explanation),
      h(
        "div",
        { className: "row-footer" },
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              { action: "previous", onClickMessage: mainMessage.previous() },
              bridge,
              interactive,
            ),
          },
          "Prev",
        ),
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              { action: "reveal", onClickMessage: mainMessage.reveal() },
              bridge,
              interactive,
            ),
          },
          "Reveal",
        ),
        h(
          "button",
          {
            className: "action-button",
            ...createActionProps(
              { action: "next", onClickMessage: mainMessage.next() },
              bridge,
              interactive,
            ),
          },
          "Next",
        ),
      ),
    ),
    h(
      "section",
      { className: "panel" },
      h("span", { className: "eyebrow" }, "Beacon Sequence"),
      h(
        "div",
        { className: "beacon-list" },
        viewModel.beacons.map((beacon: NavigatorBeaconListItem) =>
          h(
            "button",
            {
              key: beacon.id,
              className: "beacon-button",
              "data-current": beacon.isCurrent ? "true" : "false",
              ...createActionProps(
                {
                  action: "select-beacon",
                  onClickMessage: mainMessage.selectBeacon(viewModel.pathId, beacon.id),
                  pathId: viewModel.pathId,
                  beaconId: beacon.id,
                },
                bridge,
                interactive,
              ),
            },
            h(
              "span",
              { className: "beacon-row-header" },
              h("span", { className: "step-chip" }, `Step ${String(beacon.stepNumber)}`),
              h("span", { className: "current-chip" }, "Current step"),
            ),
            h("span", { className: "beacon-row-title" }, beacon.title),
            h("span", { className: "beacon-row-caption" }, beacon.summary),
          )
        ),
      ),
    ),
  );
}
