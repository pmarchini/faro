import assert from "node:assert/strict";
import test from "node:test";

import { beaconExcerpt, hunksOverlapping, sliceLines } from "../../claude-code/code-excerpt.ts";

const TEXT = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");

test("slice lines is 1-based and clamped to the file", () => {
  assert.deepEqual(sliceLines(TEXT, 2, 3), { source: "line 2\nline 3", startLine: 2 });
  assert.equal(sliceLines(TEXT, 19, 40).source, "line 19\nline 20");
});

test("beacon excerpt keeps context inside the anchor", () => {
  assert.deepEqual(beaconExcerpt(TEXT, 5, { startLine: 4, endLine: 10 }), {
    source: "line 4\nline 5\nline 6\nline 7",
    startLine: 4,
  });
});

const DIFF = `diff --git a/a.ts b/a.ts
index 1..2 100644
--- a/a.ts
+++ b/a.ts
@@ -1,3 +1,3 @@
 one
-two
+TWO
 three
@@ -40,2 +40,3 @@ function later() {
 forty
+forty-one
 forty-two`;

test("hunks overlapping keep only the hunks that touch the range", () => {
  assert.equal(hunksOverlapping(DIFF, 2, 2), "@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three");
  assert.match(hunksOverlapping(DIFF, 41, 41), /^@@ -40,2 \+40,3 @@/);
  assert.equal(hunksOverlapping(DIFF, 10, 20), "");
});
