import assert from "node:assert/strict";
import test from "node:test";

import { codeWindow, diffRows, foldRows, sourceRows } from "../../claude-code/code-window.ts";

const FILE = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join("\n");

const shape = (rows: ReturnType<typeof foldRows>) =>
  rows.map((row) => (row.kind === "fold" ? `~${row.count}` : `${row.row.number}${row.beacon ? (row.beacon.isCurrent ? "*" : "°") : ""}`));

test("source rows are numbered from the range's first line", () => {
  assert.deepEqual(sourceRows("a\nb\nc\nd", 2, 3), [
    { number: 2, marker: " ", text: "b" },
    { number: 3, marker: " ", text: "c" },
  ]);
});

test("diff rows follow the new side and leave removed lines unnumbered", () => {
  assert.deepEqual(diffRows("@@ -41,3 +41,3 @@\n const a\n-old()\n+await old()\n return a"), [
    { number: 41, marker: " ", text: "const a" },
    { number: null, marker: "-", text: "old()" },
    { number: 42, marker: "+", text: "await old()" },
    { number: 43, marker: " ", text: "return a" },
  ]);
});

test("lines far from every beacon fold, keeping the ends and three lines of context", () => {
  const rows = sourceRows(FILE, 40, 96);
  const beacons = [
    { line: 55, index: 0, isCurrent: true },
    { line: 61, index: 1, isCurrent: false },
    { line: 95, index: 2, isCurrent: false },
  ];

  assert.deepEqual(shape(foldRows(rows, beacons, false)), [
    "40", "~11", "52", "53", "54", "55*", "56", "57", "58", "59", "60", "61°", "62", "63", "64",
    "~27", "92", "93", "94", "95°", "96",
  ]);
  assert.equal(foldRows(rows, beacons, true).length, 57);
});

test("a short run is shown rather than folded, and changed lines are never folded", () => {
  const rows = diffRows("@@ -1,9 +1,9 @@\n a\n b\n c\n d\n-e\n+E\n f\n g\n h\n i");

  assert.deepEqual(shape(foldRows(rows, [], false)), ["1", "2", "3", "4", "null", "5", "6", "7", "8", "9"]);

  const longer = diffRows(`@@ -1,12 +1,12 @@\n${Array.from({ length: 10 }, (_, index) => ` l${index}`).join("\n")}\n-x\n+X\n end`);
  assert.deepEqual(shape(foldRows(longer, [], false)), ["1", "~9", "null", "11", "12"]);
});

test("the window centres on the current beacon, scrolls by offset, and stops at the ends", () => {
  const visual = foldRows(sourceRows(FILE, 1, 100), [{ line: 50, index: 0, isCurrent: true }], true);

  const centred = codeWindow(visual, 10, 0);
  assert.deepEqual(shape(centred.rows), ["45", "46", "47", "48", "49", "50*", "51", "52", "53", "54"]);
  assert.deepEqual(centred.hidden, { above: 44, below: 46 });
  assert.equal(centred.track.length, 10);
  assert.deepEqual(centred.track.filter((cell) => cell === "current").length, 1);
  assert.ok(centred.track.includes("window"));

  assert.deepEqual(shape(codeWindow(visual, 10, 8).rows).slice(0, 1), ["53"]);
  assert.deepEqual(shape(codeWindow(visual, 10, -100).rows).slice(0, 1), ["1"]);
  assert.deepEqual(shape(codeWindow(visual, 10, 100).rows).slice(-1), ["100"]);
});

test("everything that fits is drawn whole, with no track", () => {
  const visual = foldRows(sourceRows(FILE, 1, 5), [], false);

  assert.deepEqual(codeWindow(visual, 10, 3), { rows: visual, track: [], hidden: { above: 0, below: 0 } });
});
