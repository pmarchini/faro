import test from "node:test";
import assert from "node:assert/strict";

import { buildOutlineTreeModel } from "../../src/app/views/outline-tree-model.ts";
import type { FaroDocument } from "../../src/core/model/document.ts";

function createDocument(): FaroDocument {
  return {
    schemaVersion: 1,
    activePathId: "auth-flow",
    paths: [
      {
        id: "auth-flow",
        title: "Auth Flow",
        goal: "Trace auth",
        mainPath: ["b1", "b2"],
        branches: [],
        current: {
          mode: "main",
          index: 0,
          beaconId: "b1",
        },
        beacons: {
          b1: {
            id: "b1",
            title: "Entry route",
            fileUri: "file:///workspace/src/router.ts",
            range: {
              startLine: 10,
              startColumn: 1,
              endLine: 20,
              endColumn: 1,
            },
            summary: "The request enters the app here.",
          },
          b2: {
            id: "b2",
            title: "Session load",
            fileUri: "file:///workspace/src/session.ts",
            range: {
              startLine: 5,
              startColumn: 1,
              endLine: 12,
              endColumn: 1,
            },
            summary: "Existing session lookup.",
          },
        },
      },
      {
        id: "billing-flow",
        title: "Billing Flow",
        goal: "Trace billing",
        mainPath: [],
        branches: [],
        current: {
          mode: "main",
          index: 0,
          beaconId: null,
        },
        beacons: {},
      },
    ],
  };
}

test("empty document produces no items", () => {
  const items = buildOutlineTreeModel({
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });

  assert.deepEqual(items, []);
});

test("active path expands its beacons", () => {
  const items = buildOutlineTreeModel(createDocument());

  assert.equal(items.length, 2);
  assert.equal(items[0].id, "auth-flow");
  assert.equal(items[0].isActive, true);
  assert.equal(items[0].collapsibleState, "expanded");
  assert.deepEqual(
    items[0].children.map((child) => child.id),
    ["b1", "b2"],
  );
  assert.equal(items[1].isActive, false);
  assert.equal(items[1].collapsibleState, "collapsed");
});

test("beacon item carries command target", () => {
  const items = buildOutlineTreeModel(createDocument());
  const beacon = items[0].children[0];

  assert.deepEqual(beacon.command, {
    id: "faro.setCurrentBeacon",
    arguments: ["auth-flow", "b1"],
  });
  assert.equal(beacon.description, "The request enters the app here.");
});
