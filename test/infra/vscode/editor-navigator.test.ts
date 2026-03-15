import assert from "node:assert/strict";
import test from "node:test";

import type { BeaconRange } from "../../../src/core/model/document.ts";
import { createEditorNavigator } from "../../../src/infra/vscode/editor-navigator.ts";
import { createBeacon } from "../../core/fixtures.ts";

type RevealTarget = {
  fileUri: string;
  range: BeaconRange;
};

test("reveals a beacon target when the file exists and the range is valid", async () => {
  const revealed: RevealTarget[] = [];
  const highlighted: RevealTarget[] = [];
  const navigator = createEditorNavigator({
    fileExists: (fileUri) => fileUri === "file:///workspace/b1.ts",
    editor: {
      revealTarget(target) {
        revealed.push(target);
      },
      highlightTarget(target) {
        highlighted.push(target);
      },
    },
  });

  const result = await navigator.revealBeacon(createBeacon("b1"));

  assert.deepEqual(result, {
    status: "revealed",
    beaconId: "b1",
  });
  assert.deepEqual(revealed, [
    {
      fileUri: "file:///workspace/b1.ts",
      range: createBeacon("b1").range,
    },
  ]);
  assert.deepEqual(highlighted, [
    {
      fileUri: "file:///workspace/b1.ts",
      range: createBeacon("b1").range,
    },
  ]);
});

test("returns missing-file when the beacon file does not exist", async () => {
  let revealed = false;
  const navigator = createEditorNavigator({
    fileExists: () => false,
    editor: {
      revealTarget() {
        revealed = true;
      },
    },
  });

  const beacon = createBeacon("missing", {
    fileUri: "file:///workspace/missing.ts",
  });
  const result = await navigator.revealBeacon(beacon);

  assert.deepEqual(result, {
    status: "missing-file",
    fileUri: "file:///workspace/missing.ts",
  });
  assert.equal(revealed, false);
});

test("returns invalid-target when the beacon range is invalid", async () => {
  let revealed = false;
  const navigator = createEditorNavigator({
    fileExists: () => true,
    editor: {
      revealTarget() {
        revealed = true;
      },
    },
  });

  const result = await navigator.revealBeacon(
    createBeacon("broken", {
      range: {
        startLine: 10,
        startColumn: 1,
        endLine: 9,
        endColumn: 1,
      },
    }),
  );

  assert.deepEqual(result, {
    status: "invalid-target",
    beaconId: "broken",
  });
  assert.equal(revealed, false);
});

test("returns unsupported-editor when no editor integration is available", async () => {
  const navigator = createEditorNavigator({
    fileExists: () => true,
    editor: null,
  });

  const result = await navigator.revealBeacon(createBeacon("b1"));

  assert.deepEqual(result, {
    status: "unsupported-editor",
  });
});
