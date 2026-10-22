import assert from "node:assert/strict";
import test from "node:test";

import {
  assertValidTourDocument,
  findTourProblems,
  lintTour,
} from "../../src/core/model/tour-validation.ts";
import { createNode, createTour, createTourDocument } from "./tour-fixtures.ts";

test("accepts a minimal valid tour document", () => {
  assert.doesNotThrow(() => assertValidTourDocument(createTourDocument()));
});

test("rejects a document that is not schemaVersion 2", () => {
  assert.throws(
    () => assertValidTourDocument({ ...createTourDocument(), schemaVersion: 1 } as never),
    /schemaVersion must be 2/,
  );
});

test("rejects an active tour id that names no tour", () => {
  assert.throws(
    () => assertValidTourDocument(createTourDocument({ activeTourId: "missing" })),
    /activeTourId/,
  );
});

test("rejects a path that names a missing node", () => {
  const problems = findTourProblems(createTour({ path: ["n1", "ghost"] }));

  assert.ok(problems.some((problem) => /path names missing node ghost/.test(problem)));
});

test("rejects a path that visits a node twice", () => {
  const problems = findTourProblems(createTour({ path: ["n1", "n2", "n1"] }));

  assert.ok(problems.some((problem) => /visits n1 twice/.test(problem)));
});

test("rejects a path over twelve nodes", () => {
  const ids = Array.from({ length: 13 }, (_, index) => `n${index}`);
  const nodes = Object.fromEntries(ids.map((id) => [id, createNode(id)]));
  const problems = findTourProblems(createTour({ nodes, edges: [], path: ids, current: { nodeId: "n0", depth: 0 } }));

  assert.ok(problems.some((problem) => /13 nodes; keep at most 12/.test(problem)));
});

test("rejects an edge to a missing node and an unknown edge kind", () => {
  const problems = findTourProblems(
    createTour({
      edges: [
        { from: "n1", to: "ghost", kind: "calls" },
        { from: "n1", to: "n2", kind: "imports" as never },
      ],
    }),
  );

  assert.ok(problems.some((problem) => /ends at a missing node/.test(problem)));
  assert.ok(problems.some((problem) => /kind must be one of/.test(problem)));
});

test("rejects more than three beacons on a node", () => {
  const beacon = { label: "x", file: "src/n1.ts", line: 2 };
  const nodes = {
    ...createTour().nodes,
    n1: createNode("n1", { beacons: [beacon, beacon, beacon, beacon] }),
  };

  assert.ok(findTourProblems(createTour({ nodes })).some((problem) => /4 beacons/.test(problem)));
});

test("rejects a beacon line outside its anchor range", () => {
  const nodes = {
    ...createTour().nodes,
    n1: createNode("n1", { beacons: [{ label: "late", file: "src/n1.ts", line: 99 }] }),
  };

  assert.ok(
    findTourProblems(createTour({ nodes })).some((problem) => /outside every anchor range/.test(problem)),
  );
});

test("rejects a beacon in a file the node does not anchor", () => {
  const nodes = {
    ...createTour().nodes,
    n1: createNode("n1", { beacons: [{ label: "elsewhere", file: "src/other.ts", line: 3 }] }),
  };

  assert.ok(
    findTourProblems(createTour({ nodes })).some((problem) => /outside every anchor range/.test(problem)),
  );
});

test("rejects a node whose id does not match its key", () => {
  const nodes = { ...createTour().nodes, n1: createNode("other") };

  assert.ok(findTourProblems(createTour({ nodes })).some((problem) => /id must match its key/.test(problem)));
});

test("rejects a why without a known source", () => {
  const nodes = {
    ...createTour().nodes,
    n1: createNode("n1", { why: { text: "because", source: "guess" as never } }),
  };

  assert.ok(findTourProblems(createTour({ nodes })).some((problem) => /why needs text and a source/.test(problem)));
});

test("rejects a current node that is off the path", () => {
  const nodes = { ...createTour().nodes, s1: createNode("s1", { role: "supporting" }) };
  const problems = findTourProblems(createTour({ nodes, current: { nodeId: "s1", depth: 0 } }));

  assert.ok(problems.some((problem) => /current.nodeId/.test(problem)));
});

test("reports every problem at once", () => {
  const problems = findTourProblems(createTour({ hypothesis: "", path: ["ghost"], edges: [{ from: "n1", to: "n1", kind: "calls" }] }));

  assert.ok(problems.length >= 3);
});

test("lint flags a missing carry forward between adjacent path nodes", () => {
  const nodes = { ...createTour().nodes, n1: createNode("n1", { carryForward: undefined }) };

  assert.ok(lintTour(createTour({ nodes })).some((advice) => /n1 has no carryForward/.test(advice)));
});

test("lint does not ask the last node for a carry forward", () => {
  const nodes = { ...createTour().nodes, n3: createNode("n3", { carryForward: undefined }) };

  assert.deepEqual(lintTour(createTour({ nodes })), []);
});

test("lint flags a node over forty lines", () => {
  const nodes = {
    ...createTour().nodes,
    n2: createNode("n2", { anchors: [{ file: "src/n2.ts", range: { startLine: 1, endLine: 80 } }] }),
  };

  assert.ok(lintTour(createTour({ nodes })).some((advice) => /80 lines/.test(advice)));
});
