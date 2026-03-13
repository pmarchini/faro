import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { createOutlineTreeProvider } from "../../src/infra/vscode/outline-tree-provider.ts";
import { createDocument } from "../core/fixtures.ts";

test("root children reflect the outline projection from store state", () => {
  const store = createInMemoryStore(
    createDocument({
      paths: [
        createDocument().paths[0],
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
    }),
  );
  const provider = createOutlineTreeProvider({ store });

  const items = provider.getChildren();

  assert.equal(items.length, 2);
  assert.equal(items[0]?.type, "path");
  assert.equal(items[0]?.id, "auth-flow");
  assert.equal(items[1]?.id, "billing-flow");
});

test("path children return ordered beacons", () => {
  const store = createInMemoryStore(createDocument());
  const provider = createOutlineTreeProvider({ store });
  const [path] = provider.getChildren();

  if (!path || path.type !== "path") {
    assert.fail("expected a path element");
  }

  const children = provider.getChildren(path);

  assert.deepEqual(
    children.map((child) => child.id),
    ["b1", "b2"],
  );
});

test("tree items preserve labels and commands", () => {
  const store = createInMemoryStore(createDocument());
  const provider = createOutlineTreeProvider({ store });
  const [path] = provider.getChildren();

  if (!path || path.type !== "path") {
    assert.fail("expected a path element");
  }

  const [beacon] = provider.getChildren(path);

  if (!beacon || beacon.type !== "beacon") {
    assert.fail("expected a beacon element");
  }

  assert.deepEqual(provider.getTreeItem(path), {
    label: "Auth Flow",
    description: "Trace authentication",
    collapsibleState: 2,
    contextValue: "path",
    command: {
      command: "faro.setActivePath",
      title: "Faro: Set Active Path",
      arguments: ["auth-flow"],
    },
  });

  assert.deepEqual(provider.getTreeItem(beacon), {
    label: "Beacon b1",
    description: "Summary for b1",
    collapsibleState: 0,
    contextValue: "current-beacon",
    command: {
      command: "faro.setCurrentBeacon",
      title: "Faro: Set Current Beacon",
      arguments: ["auth-flow", "b1"],
    },
  });
});

test("provider emits a refresh signal when refresh is called", () => {
  const store = createInMemoryStore(createDocument());
  const provider = createOutlineTreeProvider({ store });
  let notifications = 0;

  const disposable = provider.onDidChangeTreeData(() => {
    notifications += 1;
  });

  provider.refresh();
  disposable.dispose();
  provider.refresh();

  assert.equal(notifications, 1);
});
