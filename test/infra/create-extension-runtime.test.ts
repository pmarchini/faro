import assert from "node:assert/strict";
import test from "node:test";

import { createExtensionRuntime } from "../../src/infra/vscode/create-extension-runtime.ts";
import { createOutlineTreeProvider } from "../../src/infra/vscode/outline-tree-provider.ts";
import type { FaroDocument } from "../../src/core/model/document.ts";

function createWorkspaceState(initialValue: FaroDocument | undefined) {
  let storedValue = initialValue;

  return {
    get(key: string) {
      return key === "faro.document" ? storedValue : undefined;
    },
    update(key: string, value: FaroDocument) {
      if (key === "faro.document") {
        storedValue = value;
      }

      return Promise.resolve();
    },
    snapshot() {
      return storedValue;
    },
  };
}

test("runtime creates one canonical store and refreshes listeners after navigation", async () => {
  const revealed: string[] = [];
  const runtime = createExtensionRuntime({
    revealBeacon: async (beacon) => {
      revealed.push(beacon.id);
      return { status: "revealed" };
    },
  });
  let refreshes = 0;

  const unsubscribe = runtime.subscribeToRefresh(() => {
    refreshes += 1;
  });

  const result = await runtime.commands.nextBeacon();

  assert.deepEqual(result, { status: "revealed" });
  assert.equal(runtime.store.load().paths[0]?.current?.beaconId, "b2");
  assert.deepEqual(revealed, ["b2"]);
  assert.equal(refreshes, 1);

  unsubscribe();
  runtime.dispose();
});

test("runtime uses workspace state when available", () => {
  const workspaceState = createWorkspaceState({
    schemaVersion: 1,
    activePathId: "stored-flow",
    paths: [
      {
        id: "stored-flow",
        title: "Stored Flow",
        goal: "Use persisted state",
        mainPath: ["sb1"],
        branches: [],
        current: {
          mode: "main",
          index: 0,
          beaconId: "sb1",
        },
        beacons: {
          sb1: {
            id: "sb1",
            title: "Stored Beacon",
            fileUri: "file:///workspace/stored.ts",
            range: {
              startLine: 1,
              startColumn: 1,
              endLine: 2,
              endColumn: 1,
            },
            summary: "Stored summary",
            explanation: "Stored explanation",
            tags: [],
            children: [],
          },
        },
      },
    ],
  });
  const runtime = createExtensionRuntime({ workspaceState });

  assert.equal(runtime.store.load().activePathId, "stored-flow");

  runtime.dispose();
});

test("runtime exposes setCurrentBeacon through the command surface", async () => {
  const revealed: string[] = [];
  const runtime = createExtensionRuntime({
    revealBeacon: async (beacon) => {
      revealed.push(beacon.id);
      return { status: "revealed" };
    },
  });

  const result = await runtime.commands.setCurrentBeacon("sample-flow", "b2");

  assert.deepEqual(result, { status: "revealed" });
  assert.equal(runtime.store.load().paths[0]?.current?.beaconId, "b2");
  assert.deepEqual(revealed, ["b2"]);

  runtime.dispose();
});

test("runtime command and outline command payload drive one behavior loop", async () => {
  const revealed: string[] = [];
  const runtime = createExtensionRuntime({
    revealBeacon: async (beacon) => {
      revealed.push(beacon.id);
      return { status: "revealed", beaconId: beacon.id };
    },
  });
  const outline = createOutlineTreeProvider({ store: runtime.store });
  let refreshes = 0;

  const unsubscribe = runtime.subscribeToRefresh(() => {
    refreshes += 1;
    outline.refresh();
  });

  const [path] = outline.getChildren();
  assert.equal(path?.type, "path");
  if (!path || path.type !== "path") {
    assert.fail("expected path");
  }

  const [, secondBeacon] = outline.getChildren(path);
  assert.equal(secondBeacon?.type, "beacon");
  if (!secondBeacon || secondBeacon.type !== "beacon") {
    assert.fail("expected beacon");
  }

  const command = outline.getTreeItem(secondBeacon).command;
  assert.deepEqual(command, {
    command: "faro.setCurrentBeacon",
    title: "Faro: Set Current Beacon",
    arguments: ["sample-flow", "b2"],
  });
  if (!command || command.command !== "faro.setCurrentBeacon") {
    assert.fail("expected setCurrentBeacon command");
  }

  const result = await runtime.commands.setCurrentBeacon(command.arguments[0], command.arguments[1]);

  assert.deepEqual(result, { status: "revealed", beaconId: "b2" });
  assert.equal(runtime.store.load().paths[0]?.current?.beaconId, "b2");
  assert.deepEqual(revealed, ["b2"]);
  assert.equal(refreshes, 1);

  unsubscribe();
  outline.dispose();
  runtime.dispose();
});
