import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyTourDocument, migrateDocumentToV2 } from "../../src/core/model/tour.ts";
import { assertValidTourDocument } from "../../src/core/model/tour-validation.ts";
import {
  changeDepth,
  focusNode,
  getTour,
  moveOnPath,
  removeTour,
  updateNode,
  upsertTour,
} from "../../src/core/services/tour-machine.ts";
import { createDocument } from "./fixtures.ts";
import { createNode, createTour, createTourDocument } from "./tour-fixtures.ts";

test("upsert adds a tour and makes it active", () => {
  const document = upsertTour(createEmptyTourDocument(), createTour());

  assert.equal(document.activeTourId, "session-persistence");
  assert.equal(document.tours.length, 1);
});

test("upsert replaces a tour with the same id in place", () => {
  const first = upsertTour(createEmptyTourDocument(), createTour({ id: "a" }));
  const both = upsertTour(first, createTour({ id: "b" }));
  const replaced = upsertTour(both, createTour({ id: "a", title: "Renamed" }));

  assert.deepEqual(replaced.tours.map((tour) => tour.id), ["a", "b"]);
  assert.equal(replaced.tours[0]?.title, "Renamed");
});

test("upsert refuses an invalid tour and leaves the document untouched", () => {
  const document = createEmptyTourDocument();

  assert.throws(() => upsertTour(document, createTour({ path: ["ghost"] })), /missing node ghost/);
  assert.equal(document.tours.length, 0);
});

test("upsert puts a cursor that is off the path on the first node", () => {
  const document = upsertTour(
    createEmptyTourDocument(),
    createTour({ current: { nodeId: null, depth: 0 } }),
  );

  assert.equal(getTour(document)?.current.nodeId, "n1");
});

test("move on path stops at both ends", () => {
  let document = createTourDocument();
  document = moveOnPath(document, "session-persistence", -1);
  assert.equal(getTour(document)?.current.nodeId, "n1");

  document = moveOnPath(document, "session-persistence", 5);
  assert.equal(getTour(document)?.current.nodeId, "n3");
});

test("depth stays between 0 and 2", () => {
  let document = createTourDocument();
  document = changeDepth(document, "session-persistence", 1);
  document = changeDepth(document, "session-persistence", 1);
  document = changeDepth(document, "session-persistence", 1);
  assert.equal(getTour(document)?.current.depth, 2);

  document = changeDepth(document, "session-persistence", -5);
  assert.equal(getTour(document)?.current.depth, 0);
});

test("focus refuses an unknown node", () => {
  assert.throws(() => focusNode(createTourDocument(), "session-persistence", "ghost"), /no node ghost/);
});

test("update node replaces a known node and keeps the cursor", () => {
  const document = updateNode(createTourDocument(), "session-persistence", {
    node: createNode("n2", { summary: "Simpler words" }),
  });
  const tour = getTour(document);

  assert.equal(tour?.nodes.n2?.summary, "Simpler words");
  assert.equal(tour?.current.nodeId, "n1");
});

test("update node needs insertAfter to add a node", () => {
  assert.throws(
    () => updateNode(createTourDocument(), "session-persistence", { node: createNode("n4") }),
    /pass insertAfter/,
  );

  const document = updateNode(createTourDocument(), "session-persistence", {
    node: createNode("n4"),
    insertAfter: "n1",
  });

  assert.deepEqual(getTour(document)?.path, ["n1", "n4", "n2", "n3"]);
});

test("update node refuses a node that breaks the beacon rules", () => {
  assert.throws(
    () =>
      updateNode(createTourDocument(), "session-persistence", {
        node: createNode("n2", { beacons: [{ label: "far", file: "src/n2.ts", line: 500 }] }),
      }),
    /outside every anchor range/,
  );
});

test("remove tour moves the active tour to the last one left", () => {
  const document = upsertTour(upsertTour(createEmptyTourDocument(), createTour({ id: "a" })), createTour({ id: "b" }));
  const removed = removeTour(document, "b");

  assert.equal(removed.activeTourId, "a");
  assert.equal(removeTour(removed, "a").activeTourId, null);
});

test("migrates a v1 document into valid tours with no edges", () => {
  const migrated = migrateDocumentToV2(createDocument());

  assert.doesNotThrow(() => assertValidTourDocument(migrated));
  assert.equal(migrated.activeTourId, "auth-flow");

  const tour = migrated.tours[0];
  assert.deepEqual(tour?.path, ["b1", "b2"]);
  assert.deepEqual(tour?.edges, []);
  assert.equal(tour?.nodes.b1?.anchors[0]?.file, "/workspace/b1.ts");
  assert.equal(tour?.current.nodeId, "b1");
});
