import assert from "node:assert/strict";
import test from "node:test";

import {
  moveToNextBeacon,
  moveToPreviousBeacon,
  setActivePath,
  setCurrentBeacon,
} from "../../src/core/services/path-machine.ts";
import { createDocument, createPath } from "./fixtures.ts";

test("move next advances within the main path", () => {
  const updatedDocument = moveToNextBeacon(createDocument());
  const path = updatedDocument.paths[0];

  assert.equal(path.current?.index, 1);
  assert.equal(path.current?.beaconId, "b2");
});

test("move next clamps at the end", () => {
  const updatedDocument = moveToNextBeacon(
    createDocument({
      paths: [
        createPath({
          current: {
            mode: "main",
            index: 1,
            beaconId: "b2",
          },
        }),
      ],
    }),
  );

  assert.equal(updatedDocument.paths[0].current?.index, 1);
  assert.equal(updatedDocument.paths[0].current?.beaconId, "b2");
});

test("move previous clamps at the start", () => {
  const updatedDocument = moveToPreviousBeacon(createDocument());

  assert.equal(updatedDocument.paths[0].current?.index, 0);
  assert.equal(updatedDocument.paths[0].current?.beaconId, "b1");
});

test("set current beacon by id updates the index", () => {
  const updatedDocument = setCurrentBeacon(createDocument(), "auth-flow", "b2");

  assert.equal(updatedDocument.paths[0].current?.index, 1);
  assert.equal(updatedDocument.paths[0].current?.beaconId, "b2");
});

test("set active path resets the current pointer to the first valid beacon", () => {
  const updatedDocument = setActivePath(
    createDocument({
      activePathId: "auth-flow",
      paths: [
        createPath(),
        createPath({
          id: "billing-flow",
          title: "Billing Flow",
          mainPath: ["b10"],
          current: {
            mode: "main",
            index: 99,
            beaconId: "missing",
          },
          beacons: {
            b10: {
              id: "b10",
              title: "Billing entry",
              fileUri: "file:///workspace/billing.ts",
              range: {
                startLine: 1,
                startColumn: 1,
                endLine: 2,
                endColumn: 1,
              },
              summary: "Billing entry",
              explanation: "Billing entry point",
              tags: [],
              children: [],
            },
          },
        }),
      ],
    }),
    "billing-flow",
  );

  const path = updatedDocument.paths.find((entry) => entry.id === "billing-flow");

  assert.equal(updatedDocument.activePathId, "billing-flow");
  assert.deepEqual(path?.current, {
    mode: "main",
    index: 0,
    beaconId: "b10",
  });
});
