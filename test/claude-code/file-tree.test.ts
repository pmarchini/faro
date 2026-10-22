import assert from "node:assert/strict";
import test from "node:test";

import { fileTree } from "../../claude-code/file-tree.ts";

test("file tree nests the tour's files and marks where the reader is", () => {
  const rows = fileTree([
    { file: "claude-code/tools.ts", steps: [2, 3], isCurrent: true, isVisited: true },
    { file: "src/core/model/tour-validation.ts", steps: [1], isCurrent: false, isVisited: true },
    { file: "claude-code/pane/path-view.tsx", steps: [4], isCurrent: false, isVisited: false },
    { file: "claude-code/test/tour.test.tsx", steps: [], isCurrent: false, isVisited: false },
  ]);

  assert.deepEqual(
    rows.map((row) => row.text),
    [
      "├─ claude-code/",
      "│  ├─ pane/",
      "│  │  └─   path-view.tsx  4",
      "│  ├─ test/",
      "│  │  └─   tour.test.tsx  ·",
      "│  └─ ▸ tools.ts  2,3",
      "└─ src/core/model/",
      "   └─ ✓ tour-validation.ts  1",
    ],
  );
  assert.deepEqual(
    rows.filter((row) => row.isCurrent).map((row) => row.text.trim()),
    ["│  └─ ▸ tools.ts  2,3"],
  );
  assert.equal(rows.find((row) => row.text.includes("tour.test.tsx"))?.isDim, true);
});

test("file tree orders files by the first step that reads them", () => {
  const rows = fileTree([
    { file: "b.ts", steps: [3], isCurrent: false, isVisited: false },
    { file: "a.ts", steps: [5], isCurrent: false, isVisited: false },
    { file: "c.ts", steps: [1], isCurrent: false, isVisited: false },
  ]);

  assert.deepEqual(
    rows.map((row) => row.text),
    ["├─   c.ts  1", "├─   b.ts  3", "└─   a.ts  5"],
  );
});
