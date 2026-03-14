import test from "node:test";
import assert from "node:assert/strict";

import { buildNavigatorViewModel } from "../../src/app/views/navigator-view-model.ts";
import type { FaroDocument, FaroPath } from "../../src/core/model/document.ts";

function createDocument(overrides: Partial<FaroPath> = {}): FaroDocument {
  return {
    schemaVersion: 1,
    activePathId: "auth-flow",
    paths: [
      {
        id: "auth-flow",
        title: "Auth Flow",
        goal: "Trace auth",
        mainPath: ["b1", "b2"],
        branches: [],
        current: {
          mode: "main",
          index: 0,
          beaconId: "b1",
        },
        beacons: {
          b1: {
            id: "b1",
            title: "Entry route",
            fileUri: "file:///workspace/src/router.ts",
            range: {
              startLine: 10,
              startColumn: 1,
              endLine: 20,
              endColumn: 1,
            },
            summary: "The request enters the app here.",
            explanation: "The route normalizes auth headers.",
            tags: ["entrypoint"],
            children: [],
          },
          b2: {
            id: "b2",
            title: "Session load",
            fileUri: "file:///workspace/src/session.ts",
            range: {
              startLine: 5,
              startColumn: 1,
              endLine: 12,
              endColumn: 1,
            },
            summary: "Existing session lookup.",
            explanation: "Loads the session from storage.",
            tags: ["session"],
            children: [],
          },
        },
        ...overrides,
      },
    ],
  };
}

test("shows empty state without active path", () => {
  const viewModel = buildNavigatorViewModel({
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });

  assert.deepEqual(viewModel, {
    state: "empty",
    title: "No active path",
    message: "Ask an agent to create a Faro path to get started.",
    canGoPrevious: false,
    canGoNext: false,
  });
});

test("shows current beacon title summary and position", () => {
  const viewModel = buildNavigatorViewModel(createDocument());

  assert.equal(viewModel.state, "ready");
  if (viewModel.state !== "ready") {
    return;
  }

  assert.equal(viewModel.pathTitle, "Auth Flow");
  assert.equal(viewModel.goal, "Trace auth");
  assert.equal(viewModel.beaconTitle, "Entry route");
  assert.equal(viewModel.summary, "The request enters the app here.");
  assert.equal(viewModel.explanation, "The route normalizes auth headers.");
  assert.equal(viewModel.currentStepNumber, 1);
  assert.equal(viewModel.beaconCount, 2);
  assert.equal(viewModel.positionLabel, "1 of 2");
  assert.equal(viewModel.canGoPrevious, false);
  assert.equal(viewModel.canGoNext, true);
  assert.deepEqual(viewModel.beacons, [
    {
      id: "b1",
      title: "Entry route",
      isCurrent: true,
    },
    {
      id: "b2",
      title: "Session load",
      isCurrent: false,
    },
  ]);
});

test("derives the current step number from the active beacon index", () => {
  const viewModel = buildNavigatorViewModel(
    createDocument({
      current: {
        mode: "main",
        index: 1,
        beaconId: "b2",
      },
    }),
  );

  assert.equal(viewModel.state, "ready");
  if (viewModel.state !== "ready") {
    return;
  }

  assert.equal(viewModel.currentStepNumber, 2);
  assert.equal(viewModel.beaconCount, 2);
  assert.equal(viewModel.positionLabel, "2 of 2");
});

test("disables prev at start", () => {
  const viewModel = buildNavigatorViewModel(createDocument());

  assert.equal(viewModel.canGoPrevious, false);
});

test("disables next at end", () => {
  const viewModel = buildNavigatorViewModel(
    createDocument({
      current: {
        mode: "main",
        index: 1,
        beaconId: "b2",
      },
    }),
  );

  assert.equal(viewModel.canGoPrevious, true);
  assert.equal(viewModel.canGoNext, false);
});

test("beacon list follows main path order and marks the current beacon", () => {
  const viewModel = buildNavigatorViewModel(
    createDocument({
      mainPath: ["b2", "b1"],
      current: {
        mode: "main",
        index: 0,
        beaconId: "b2",
      },
    }),
  );

  assert.equal(viewModel.state, "ready");
  if (viewModel.state !== "ready") {
    return;
  }

  assert.deepEqual(viewModel.beacons, [
    {
      id: "b2",
      title: "Session load",
      isCurrent: true,
    },
    {
      id: "b1",
      title: "Entry route",
      isCurrent: false,
    },
  ]);
});

test("shows an empty state when the current beacon is missing", () => {
  const viewModel = buildNavigatorViewModel(
    createDocument({
      current: {
        mode: "main",
        index: 0,
        beaconId: "missing",
      },
    }),
  );

  assert.deepEqual(viewModel, {
    state: "empty",
    title: "Current beacon unavailable",
    message: "The active path does not have a valid current beacon.",
    canGoPrevious: false,
    canGoNext: false,
  });
});
