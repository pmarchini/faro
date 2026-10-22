import assert from "node:assert/strict";
import test from "node:test";

import { LOGO_ROWS, LOGO_WIDTH, logoSegments } from "../../claude-code/pane/logo.ts";

test("every logo row is the logo's width, so the header beside it stays aligned", () => {
  assert.ok(LOGO_ROWS.every((row) => row.length === LOGO_WIDTH));
});

test("logo segments split the hexagon from the lighthouse and keep every character", () => {
  assert.deepEqual(logoSegments("o-'  /#\\  '-o"), [
    { text: "o-'  ", isLight: false },
    { text: "/#\\  ", isLight: true },
    { text: "'-o", isLight: false },
  ]);

  for (const row of LOGO_ROWS) {
    assert.equal(logoSegments(row).map((segment) => segment.text).join(""), row);
  }
});
