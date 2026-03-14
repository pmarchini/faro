import assert from "node:assert/strict";
import test from "node:test";

import { createExtensionRuntime } from "../../src/infra/vscode/create-extension-runtime.ts";
import { createOutlineTreeProvider } from "../../src/infra/vscode/outline-tree-provider.ts";
import type { FaroDocument } from "../../src/core/model/document.ts";

function createWorkspaceState(initialValue: FaroDocument | undefined) {
  const values = new Map<string, unknown>();

  if (initialValue) {
    values.set("faro.document", initialValue);
  }

  return {
    get(key: string) {
      return values.get(key);
    },
    update(key: string, value: unknown) {
      values.set(key, value);
      return Promise.resolve();
    },
    snapshot() {
      return {
        document: values.get("faro.document"),
        ui: values.get("faro.ui"),
      };
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
  assert.deepEqual(runtime.uiState.load(), {
    welcomeDismissed: false,
  });

  runtime.dispose();
});

test("runtime persists welcome dismissal in workspace ui state", async () => {
  const workspaceState = createWorkspaceState(undefined);
  const runtime = createExtensionRuntime({ workspaceState });

  await runtime.uiState.dismissWelcome();

  assert.deepEqual(runtime.uiState.load(), {
    welcomeDismissed: true,
  });
  assert.deepEqual(workspaceState.snapshot().ui, {
    welcomeDismissed: true,
  });

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

test("runtime exposes one agent service and MCP bootstrap over the canonical store", () => {
  const runtime = createExtensionRuntime();

  assert.equal(runtime.agent.getPath("sample-flow")?.id, "sample-flow");

  const listPaths = runtime.mcp.tools["faro.listPaths"].execute();
  assert.deepEqual(listPaths, {
    ok: true,
    value: {
      paths: runtime.agent.listPaths(),
    },
  });

  const pathResource = runtime.mcp.resources.read("faro://paths/sample-flow");
  assert.equal(pathResource?.uri, "faro://paths/sample-flow");
  assert.equal(runtime.store.load().paths[0]?.id, "sample-flow");

  runtime.dispose();
});

test("runtime MCP writes are visible through agent reads, MCP reads, and the canonical store", () => {
  const runtime = createExtensionRuntime();

  const upsert = runtime.mcp.tools["faro.upsertPath"].execute({
    path: {
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
  });

  assert.equal(upsert.ok, true);
  assert.equal(runtime.agent.getPath("billing-flow")?.id, "billing-flow");
  const billingPathResource = runtime.mcp.resources.read("faro://paths/billing-flow");

  assert.ok(billingPathResource);
  assert.equal(billingPathResource.uri, "faro://paths/billing-flow");
  assert.equal(billingPathResource.contents.id, "billing-flow");
  assert.equal(runtime.store.load().paths.some((path) => path.id === "billing-flow"), true);

  const setCurrent = runtime.mcp.tools["faro.setCurrentBeacon"].execute({
    pathId: "sample-flow",
    beaconId: "b2",
  });

  assert.equal(setCurrent.ok, true);
  assert.equal(runtime.agent.getPath("sample-flow")?.current?.beaconId, "b2");
  assert.deepEqual(runtime.mcp.tools["faro.getPath"].execute({ pathId: "sample-flow" }), {
    ok: true,
    value: {
      path: runtime.agent.getPath("sample-flow"),
    },
  });

  runtime.dispose();
});

test("runtime refreshes listeners after MCP-driven writes", () => {
  const runtime = createExtensionRuntime();
  let refreshes = 0;

  const unsubscribe = runtime.subscribeToRefresh(() => {
    refreshes += 1;
  });

  const beforeUpsert = refreshes;

  runtime.mcp.tools["faro.upsertPath"].execute({
    path: {
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
  });
  assert.ok(refreshes > beforeUpsert);

  const beforeSetCurrent = refreshes;

  runtime.mcp.tools["faro.setCurrentBeacon"].execute({
    pathId: "sample-flow",
    beaconId: "b2",
  });
  assert.ok(refreshes > beforeSetCurrent);

  unsubscribe();
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
