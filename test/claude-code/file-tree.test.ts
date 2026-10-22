import assert from "node:assert/strict";
import test from "node:test";

import { compactFiles, railFiles } from "../../claude-code/file-tree.ts";

test("compact files list each folder once, in step order, and mark where the reader is", () => {
  const rows = compactFiles([
    { file: "claude-code/tools.ts", steps: [2, 3], isCurrent: true, isVisited: true },
    { file: "src/core/model/tour-validation.ts", steps: [1], isCurrent: false, isVisited: true },
    { file: "claude-code/pane/path-view.tsx", steps: [4], isCurrent: false, isVisited: false },
    { file: "claude-code/test/tour.test.tsx", steps: [], isCurrent: false, isVisited: false },
    { file: "./README.md", steps: [5], isCurrent: false, isVisited: false },
  ]);

  assert.deepEqual(
    rows.map((row) => row.text),
    [
      "src/core/model/    ✓ tour-validation.ts",
      "claude-code/       ▸ tools.ts",
      "claude-code/pane/  · path-view.tsx",
      "./                 · README.md",
      "claude-code/test/  · tour.test.tsx",
    ],
  );
  assert.deepEqual(
    rows.map((row) => [row.isCurrent, row.isDim]),
    [
      [false, false],
      [true, false],
      [false, false],
      [false, false],
      [false, true],
    ],
  );
});

test("rail files list each folder, then its files under it", () => {
  const rows = railFiles([
    { file: "auth/session.ts", steps: [3], isCurrent: true, isVisited: true },
    { file: "auth/routes.ts", steps: [1], isCurrent: false, isVisited: true },
    { file: "db/store.ts", steps: [4], isCurrent: false, isVisited: false },
  ]);

  assert.deepEqual(
    rows.map((row) => row.text),
    ["auth/", "  ✓ routes.ts", "  ▸ session.ts", "db/", "  · store.ts"],
  );
  assert.deepEqual(
    rows.filter((row) => row.isCurrent).map((row) => row.text),
    ["  ▸ session.ts"],
  );
});
