import assert from "node:assert/strict";
import test from "node:test";

import type { TourSubPath } from "../../src/core/model/tour.ts";
import { findTourProblems, lintTour } from "../../src/core/model/tour-validation.ts";
import {
  addSubPath,
  enterPath,
  focusNode,
  getTour,
  moveOnPath,
  pathPosition,
  pathTrail,
  subPathsAt,
  surface,
  upsertTour,
} from "../../src/core/services/tour-machine.ts";
import { createEmptyTourDocument } from "../../src/core/model/tour.ts";
import { createNode, createTour, createTourDocument } from "./tour-fixtures.ts";

const TOUR = "session-persistence";

function subPath(overrides: Partial<TourSubPath> = {}): TourSubPath {
  return {
    id: "signing",
    title: "How a token is signed",
    question: "What does sign() do with the keys?",
    anchor: { path: "main", node: "n2" },
    steps: ["s1", "s2"],
    ...overrides,
  };
}

function withSigning() {
  return addSubPath(createTourDocument(), TOUR, {
    subPath: subPath(),
    nodes: [createNode("s1"), createNode("s2")],
  });
}

test("a sub path is added under a step without moving the reader", () => {
  const document = withSigning();
  const tour = getTour(document);

  assert.deepEqual(tour?.subPaths?.signing?.steps, ["s1", "s2"]);
  assert.equal(tour?.current.nodeId, "n1");
  assert.equal(tour?.current.pathId, undefined);
  assert.deepEqual(subPathsAt(tour!, "main", "n2").map((entry) => entry.id), ["signing"]);
});

test("a sub path must hang from a step of an existing path", () => {
  assert.throws(
    () =>
      addSubPath(createTourDocument(), TOUR, {
        subPath: subPath({ anchor: { path: "main", node: "ghost" } }),
        nodes: [createNode("s1"), createNode("s2")],
      }),
    /anchor.node ghost is not a step of path main/,
  );
  assert.throws(
    () =>
      addSubPath(createTourDocument(), TOUR, {
        subPath: subPath({ anchor: { path: "nowhere", node: "n1" } }),
        nodes: [createNode("s1"), createNode("s2")],
      }),
    /missing path nowhere/,
  );
});

test("a sub path names its steps, keeps them short and may not be called main", () => {
  const problems = findTourProblems(
    createTour({
      nodes: { n1: createNode("n1") },
      path: ["n1"],
      current: { nodeId: "n1", depth: 0 },
      subPaths: {
        main: { ...subPath({ id: "main", anchor: { path: "main", node: "n1" } }), steps: ["ghost"] },
        long: subPath({ id: "long", anchor: { path: "main", node: "n1" }, steps: Array(8).fill("n1") }),
      },
    }),
  ).join("\n");

  assert.match(problems, /names the main path/);
  assert.match(problems, /missing node ghost/);
  assert.match(problems, /has 8 steps; keep at most 7/);
});

test("anchors must lead back to the main path", () => {
  const problems = findTourProblems(
    createTour({
      nodes: { ...createTour().nodes, s1: createNode("s1"), s2: createNode("s2") },
      subPaths: {
        a: subPath({ id: "a", anchor: { path: "b", node: "s2" }, steps: ["s1"] }),
        b: subPath({ id: "b", anchor: { path: "a", node: "s1" }, steps: ["s2"] }),
      },
    }),
  ).join("\n");

  assert.match(problems, /hangs from itself/);
});

test("a line anchor needs its file", () => {
  assert.throws(
    () =>
      addSubPath(createTourDocument(), TOUR, {
        subPath: subPath({ anchor: { path: "main", node: "n2", line: 0 } }),
        nodes: [createNode("s1"), createNode("s2")],
      }),
    /1-based integer[\s\S]*needs anchor.file/,
  );
});

test("a dive hint needs a question", () => {
  const problems = findTourProblems(
    createTour({ nodes: { ...createTour().nodes, n2: createNode("n2", { dive: { question: " " } }) } }),
  );

  assert.match(problems.join("\n"), /n2 dive needs a question/);
});

test("entering a sub path reads it, and j off its end surfaces to the step it hangs from", () => {
  let document = enterPath(withSigning(), TOUR, "signing");
  assert.deepEqual(getTour(document)?.current, { nodeId: "s1", depth: 0, pathId: "signing" });
  assert.deepEqual(pathPosition(getTour(document)!), { index: 0, total: 2 });

  document = moveOnPath(document, TOUR, 1);
  assert.equal(getTour(document)?.current.nodeId, "s2");

  document = moveOnPath(document, TOUR, 1);
  assert.deepEqual(getTour(document)?.current, { nodeId: "n2", depth: 0 });
});

test("k off the start of a sub path surfaces too, and s surfaces from anywhere in it", () => {
  const inside = enterPath(withSigning(), TOUR, "signing");

  assert.equal(getTour(moveOnPath(inside, TOUR, -1))?.current.nodeId, "n2");
  assert.equal(getTour(surface(moveOnPath(inside, TOUR, 1), TOUR))?.current.nodeId, "n2");
  assert.equal(surface(createTourDocument(), TOUR).tours[0]?.current.nodeId, "n1");
});

test("sub paths nest, and the trail lists every level down to the reader", () => {
  let document = addSubPath(withSigning(), TOUR, {
    subPath: subPath({ id: "keys", title: "Where keys come from", anchor: { path: "signing", node: "s2" }, steps: ["k1"] }),
    nodes: [createNode("k1")],
  });
  document = enterPath(document, TOUR, "keys");

  assert.deepEqual(pathTrail(getTour(document)!), [
    { pathId: "main", nodeId: "n2" },
    { pathId: "signing", nodeId: "s2" },
    { pathId: "keys" },
  ]);

  document = surface(document, TOUR);
  assert.deepEqual(getTour(document)?.current, { nodeId: "s2", depth: 0, pathId: "signing" });
});

test("focus finds the path a step is on, or takes the one named", () => {
  const document = withSigning();

  assert.equal(getTour(focusNode(document, TOUR, "s2"))?.current.pathId, "signing");
  assert.equal(getTour(focusNode(document, TOUR, "n3"))?.current.pathId, undefined);
  assert.throws(() => focusNode(document, TOUR, "n3", "signing"), /no step n3/);
});

test("a rewritten tour keeps a reader inside a sub path that still exists", () => {
  const tour = getTour(enterPath(withSigning(), TOUR, "signing"))!;
  const document = upsertTour(createEmptyTourDocument(), { ...tour, current: { ...tour.current, nodeId: "s2" } });

  assert.deepEqual(getTour(document)?.current, { nodeId: "s2", depth: 0, pathId: "signing" });

  const { subPaths: _, ...withoutSubPaths } = tour;
  assert.deepEqual(getTour(upsertTour(createEmptyTourDocument(), withoutSubPaths as typeof tour))?.current, {
    nodeId: "n1",
    depth: 0,
  });
});

test("lint advises a long sub path to stay short", () => {
  const tour = getTour(
    addSubPath(createTourDocument(), TOUR, {
      subPath: subPath({ steps: ["s1", "s2", "s3", "s4", "s5", "s6"] }),
      nodes: ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => createNode(id)),
    }),
  )!;

  assert.ok(lintTour(tour).some((line) => line.includes("Sub path signing has 6 steps")));
});
