import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { createDocument, createPath } from "./fixtures.ts";

test("load returns the default empty document", () => {
  const store = createInMemoryStore();

  assert.deepEqual(store.load(), {
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });
});

test("upsert path replaces an existing path", () => {
  const store = createInMemoryStore(createDocument());

  store.upsertPath(
    createPath({
      title: "Updated Auth Flow",
    }),
  );

  assert.equal(store.load().paths[0]?.title, "Updated Auth Flow");
});

test("set active path updates the current selection", () => {
  const store = createInMemoryStore(
    createDocument({
      paths: [
        createPath(),
        createPath({
          id: "billing-flow",
          title: "Billing Flow",
          mainPath: ["b10"],
          current: {
            mode: "main",
            index: 0,
            beaconId: "b10",
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
  );

  store.setActivePath("billing-flow");

  assert.equal(store.load().activePathId, "billing-flow");
});

test("subscribers are notified on mutation", () => {
  const store = createInMemoryStore(createDocument());
  let notifications = 0;

  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });

  store.setCurrentBeacon("auth-flow", "b2");
  unsubscribe();
  store.setCurrentBeacon("auth-flow", "b1");

  assert.equal(notifications, 1);
});

test("delete path clears the active path when needed", () => {
  const store = createInMemoryStore(createDocument());

  store.deletePath("auth-flow");

  assert.deepEqual(store.load(), {
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });
});
