import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { createDocument, createPath } from "../core/fixtures.ts";

test("listPaths returns path summaries with active and current beacon state", () => {
  const store = createInMemoryStore(
    createDocument({
      paths: [
        createPath(),
        createPath({
          id: "billing-flow",
          title: "Billing Flow",
          goal: "Trace billing",
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
  const service = createFaroAgentService({ store });

  assert.deepEqual(service.listPaths(), [
    {
      id: "auth-flow",
      title: "Auth Flow",
      goal: "Trace authentication",
      isActive: true,
      currentBeaconId: "b1",
      beaconCount: 2,
    },
    {
      id: "billing-flow",
      title: "Billing Flow",
      goal: "Trace billing",
      isActive: false,
      currentBeaconId: "b10",
      beaconCount: 1,
    },
  ]);
});

test("listPaths returns an empty list for an empty store", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(),
  });

  assert.deepEqual(service.listPaths(), []);
});

test("getPath returns a path by id and null when missing", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(createDocument()),
  });

  assert.equal(service.getPath("auth-flow")?.title, "Auth Flow");
  assert.equal(service.getPath("missing-flow"), null);
});

test("upsertPath returns the stored path with normalized current beacon", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(createDocument()),
  });

  const storedPath = service.upsertPath(
    createPath({
      current: {
        mode: "main",
        index: 99,
        beaconId: "missing-beacon",
      },
    }),
  );

  assert.deepEqual(storedPath?.current, {
    mode: "main",
    index: 0,
    beaconId: "b1",
  });
});

test("upsertPath relies on canonical validation for invalid paths", () => {
  const store = createInMemoryStore(createDocument());
  const service = createFaroAgentService({ store });
  const previousDocument = store.load();

  assert.throws(() =>
    service.upsertPath(
      createPath({
        mainPath: ["missing-beacon"],
      }),
    ),
  );

  assert.deepEqual(store.load(), previousDocument);
});

test("upsertPath inserts a new path and activates the first path in an empty document", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(),
  });

  const insertedPath = createPath({
    id: "billing-flow",
    title: "Billing Flow",
  });

  assert.equal(service.upsertPath(insertedPath)?.id, "billing-flow");

  const paths = service.listPaths();

  assert.equal(paths.length, 1);
  assert.equal(paths[0]?.id, "billing-flow");
  assert.equal(paths[0]?.isActive, true);
  assert.equal(paths[0]?.currentBeaconId, "b1");
});

test("setActivePath returns the selected path and keeps missing ids as null", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(
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
    ),
  });

  assert.equal(service.setActivePath("billing-flow")?.id, "billing-flow");
  assert.equal(service.setActivePath("missing-flow"), null);
});

test("setCurrentBeacon returns the updated path and activates it", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(createDocument()),
  });

  const path = service.setCurrentBeacon("auth-flow", "b2");

  assert.deepEqual(path?.current, {
    mode: "main",
    index: 1,
    beaconId: "b2",
  });
  assert.equal(service.listPaths()[0]?.currentBeaconId, "b2");
});

test("setCurrentBeacon returns null and keeps state unchanged for a missing beacon", () => {
  const store = createInMemoryStore(createDocument());
  const service = createFaroAgentService({ store });
  const previousDocument = store.load();

  assert.equal(service.setCurrentBeacon("auth-flow", "missing-beacon"), null);
  assert.deepEqual(store.load(), previousDocument);
});

test("deletePath reports whether a path was deleted and the next active path", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(
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
    ),
  });

  assert.deepEqual(service.deletePath("auth-flow"), {
    deleted: true,
    activePathId: "billing-flow",
  });
  assert.deepEqual(service.deletePath("missing-flow"), {
    deleted: false,
    activePathId: "billing-flow",
  });
});

test("returned paths are detached from the store snapshot", () => {
  const service = createFaroAgentService({
    store: createInMemoryStore(createDocument()),
  });

  const path = service.getPath("auth-flow");
  assert.ok(path);
  path.title = "Mutated";

  assert.equal(service.getPath("auth-flow")?.title, "Auth Flow");
});
