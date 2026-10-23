import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Tour } from "../../src/core/model/tour.ts";
import { findTourProblems } from "../../src/core/model/tour-validation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("the example tour in tour-schema.md is valid", () => {
  const page = readFileSync(path.join(root, "skills/faro-author-paths/tour-schema.md"), "utf8");
  const example = /```json\n([\s\S]*?)\n```/.exec(page)?.[1];

  assert.ok(example, "tour-schema.md has a json example");
  assert.deepEqual(findTourProblems(JSON.parse(example) as Tour), []);
});
