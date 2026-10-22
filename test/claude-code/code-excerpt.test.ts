import assert from "node:assert/strict";
import test from "node:test";

import { hunksOverlapping } from "../../claude-code/code-excerpt.ts";

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
