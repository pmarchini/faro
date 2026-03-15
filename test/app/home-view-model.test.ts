import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeViewModel } from "../../src/app/views/home-view-model.ts";
import * as fixtures from "../core/fixtures.ts";

test("buildHomeViewModel reflects the active path when one exists", () => {
  const viewModel = buildHomeViewModel(fixtures.createDocument());

  assert.equal(viewModel.title, "One entry point for Faro.");
  assert.equal(viewModel.resumeLabel, "Resume Current Path");
  assert.equal(viewModel.currentPathTitle, "Auth Flow");
  assert.match(viewModel.currentPathSummary, /Trace authentication/);
  assert.equal(viewModel.setupLabel, "Open Setup");
});

test("buildHomeViewModel falls back cleanly when there is no active path", () => {
  const viewModel = buildHomeViewModel({
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });

  assert.equal(viewModel.currentPathTitle, "No active path");
  assert.match(viewModel.currentPathSummary, /Create a Faro path/);
});
