import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../../src/core/services/in-memory-store.ts";
import { createCommandController } from "../../../src/infra/vscode/command-controller.ts";
import * as fixtures from "../../core/fixtures.ts";

test("next beacon moves the pointer and reveals the target beacon", async () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const revealed: string[] = [];
  const controller = createCommandController({
    store,
    revealBeacon: async (beacon: { id: string }) => {
      revealed.push(beacon.id);
      return { status: "revealed" };
    },
  });

  await controller.nextBeacon();

  assert.equal(store.load().paths[0].current?.beaconId, "b2");
  assert.deepEqual(revealed, ["b2"]);
});

test("previous beacon clamps at the beginning and still reveals the current beacon", async () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const revealed: string[] = [];
  const controller = createCommandController({
    store,
    revealBeacon: async (beacon: { id: string }) => {
      revealed.push(beacon.id);
      return { status: "revealed" };
    },
  });

  await controller.previousBeacon();

  assert.equal(store.load().paths[0].current?.beaconId, "b1");
  assert.deepEqual(revealed, ["b1"]);
});

test("set active path selects the path and reveals its first beacon", async () => {
  const store = createInMemoryStore(
    fixtures.createDocument({
      paths: [
        fixtures.createDocument().paths[0],
        {
          id: "billing-flow",
          title: "Billing Flow",
          goal: "Trace billing",
          mainPath: ["b10"],
          branches: [],
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
        },
      ],
    }),
  );
  const revealed: string[] = [];
  const controller = createCommandController({
    store,
    revealBeacon: async (beacon: { id: string }) => {
      revealed.push(beacon.id);
      return { status: "revealed" };
    },
  });

  await controller.setActivePath("billing-flow");

  assert.equal(store.load().activePathId, "billing-flow");
  assert.deepEqual(revealed, ["b10"]);
});

test("set current beacon selects the beacon and reveals it", async () => {
  const store = createInMemoryStore(fixtures.createDocument());
  const revealed: string[] = [];
  const controller = createCommandController({
    store,
    revealBeacon: async (beacon: { id: string }) => {
      revealed.push(beacon.id);
      return { status: "revealed" };
    },
  });

  await controller.setCurrentBeacon("auth-flow", "b2");

  assert.equal(store.load().activePathId, "auth-flow");
  assert.equal(store.load().paths[0].current?.beaconId, "b2");
  assert.deepEqual(revealed, ["b2"]);
});

test("reveal current beacon returns idle when there is no active path", async () => {
  const store = createInMemoryStore({
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  });
  const controller = createCommandController({
    store,
    revealBeacon: async () => {
      throw new Error("should not be called");
    },
  });

  const result = await controller.revealCurrentBeacon();

  assert.deepEqual(result, { status: "idle" });
});
