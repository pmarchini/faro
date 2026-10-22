import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTarget,
  diffArgv,
  parseExplainArgs,
  splitPathSymbol,
  tokenize,
} from "../../claude-code/explain-args.ts";

test("tokenize keeps quoted runs whole", () => {
  assert.deepEqual(tokenize(`#482 --goal "why do we retry twice?" --lens 'domain'`), [
    "#482",
    "--goal",
    "why do we retry twice?",
    "--lens",
    "domain",
  ]);
});

test("parse reads the target and every flag", () => {
  assert.deepEqual(parseExplainArgs(`src/billing/ --lens domain --reader new --depth=deep`), {
    request: { target: "src/billing/", depth: "deep", lens: "domain", reader: "new" },
  });
});

test("parse defaults to standard depth, flow lens and a familiar reader", () => {
  assert.deepEqual(parseExplainArgs(""), {
    request: { target: "", depth: "standard", lens: "flow", reader: "familiar" },
  });
});

test("parse joins an unquoted question back together", () => {
  const parsed = parseExplainArgs("how does this plugin work?");

  assert.ok("request" in parsed && parsed.request.target === "how does this plugin work?");
});

test("parse refuses an unknown flag or value", () => {
  assert.ok("error" in parseExplainArgs("--lens sideways"));
  assert.ok("error" in parseExplainArgs("--colour red"));
  assert.ok("error" in parseExplainArgs("--goal"));
});

test("classify tells targets apart from their words", () => {
  assert.equal(classifyTarget(""), "worktree");
  assert.equal(classifyTarget("last"), "last");
  assert.equal(classifyTarget("#123"), "pr");
  assert.equal(classifyTarget("https://github.com/pmarchini/faro/pull/7"), "pr");
  assert.equal(classifyTarget("HEAD~3..HEAD"), "range");
  assert.equal(classifyTarget("main...feature"), "range");
  assert.equal(classifyTarget("how does this plugin work?"), "question");
  assert.equal(classifyTarget("caching?"), "question");
  assert.equal(classifyTarget("src/auth/"), "probe");
  assert.equal(classifyTarget("../sibling/file.ts"), "probe");
  assert.equal(classifyTarget("feature/login"), "probe");
});

test("split path and symbol", () => {
  assert.deepEqual(splitPathSymbol("src/auth/session.ts:createSession"), {
    path: "src/auth/session.ts",
    symbol: "createSession",
  });
  assert.deepEqual(splitPathSymbol("src/auth/"), { path: "src/auth/" });
});

test("diff argv follows the target kind", () => {
  assert.deepEqual(diffArgv({ kind: "worktree", ref: "HEAD" }, "a.ts"), ["git", "diff", "HEAD", "--", "a.ts"]);
  assert.deepEqual(diffArgv({ kind: "range", ref: "A..B" }, "a.ts"), ["git", "diff", "A..B", "--", "a.ts"]);
  assert.deepEqual(diffArgv({ kind: "branch", ref: "f", baseSha: "b1", headSha: "h1" }, "a.ts"), [
    "git",
    "diff",
    "b1",
    "h1",
    "--",
    "a.ts",
  ]);
  assert.equal(diffArgv({ kind: "pr", ref: "#1" }, "a.ts"), null);
  assert.equal(diffArgv({ kind: "code", ref: "src/" }, "a.ts"), null);
  assert.equal(diffArgv({ kind: "question", ref: "how?" }, "a.ts"), null);
});
