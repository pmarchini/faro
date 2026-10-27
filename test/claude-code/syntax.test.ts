import assert from "node:assert/strict";
import test from "node:test";

import { tokens } from "../../claude-code/pane/syntax.ts";

test("a line is cut into keyword, string, number, comment and plain tokens", () => {
  assert.deepEqual(tokens('const key = "a\\"b" + 42 // why', "src/a.ts"), [
    { text: "const", kind: "keyword" },
    { text: " key = ", kind: "plain" },
    { text: '"a\\"b"', kind: "string" },
    { text: " + ", kind: "plain" },
    { text: "42", kind: "number" },
    { text: " ", kind: "plain" },
    { text: "// why", kind: "comment" },
  ]);
});

test("python comments start with #, and the text is kept whole", () => {
  const line = "def f(x):  # the guard";
  const cut = tokens(line, "app/main.py");

  assert.equal(cut.map((token) => token.text).join(""), line);
  assert.deepEqual(cut.at(-1), { text: "# the guard", kind: "comment" });
  assert.equal(cut[0]?.kind, "keyword");
});
