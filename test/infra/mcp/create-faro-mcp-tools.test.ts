import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../../src/core/services/in-memory-store.ts";
import { createFaroMcpTools } from "../../../src/infra/mcp/create-faro-mcp-tools.ts";
import { createDocument, createPath } from "../../core/fixtures.ts";

test("tools expose the supported MCP-ready faro operations", () => {
  const tools = createFaroMcpTools({
    service: createFaroAgentService({
      store: createInMemoryStore(createDocument()),
    }),
  });

  assert.deepEqual(Object.keys(tools).sort(), [
    "faro.deletePath",
    "faro.getPath",
    "faro.listPaths",
    "faro.setActivePath",
    "faro.setCurrentBeacon",
    "faro.upsertPath",
  ]);
  assert.equal(tools["faro.listPaths"].readOnlyHint, true);
  assert.equal(tools["faro.getPath"].readOnlyHint, true);
  assert.equal(tools["faro.upsertPath"].readOnlyHint, false);
});

test("listPaths and getPath return read results from the canonical store", () => {
  const tools = createFaroMcpTools({
    service: createFaroAgentService({
      store: createInMemoryStore(createDocument()),
    }),
  });

  assert.deepEqual(tools["faro.listPaths"].execute(), {
    ok: true,
    value: {
      paths: [
        {
          id: "auth-flow",
          title: "Auth Flow",
          goal: "Trace authentication",
          isActive: true,
          currentBeaconId: "b1",
          beaconCount: 2,
        },
      ],
    },
  });
  assert.deepEqual(tools["faro.getPath"].execute({ pathId: "missing-flow" }), {
    ok: false,
    error: {
      code: "path_not_found",
      message: "Path missing-flow was not found.",
    },
  });
});

test("write tools update the same underlying store and return explicit contract errors", () => {
  const tools = createFaroMcpTools({
    service: createFaroAgentService({
      store: createInMemoryStore(createDocument()),
    }),
  });

  const upsert = tools["faro.upsertPath"].execute({
    path: createPath({
      id: "billing-flow",
      title: "Billing Flow",
    }),
  });
  assert.equal(upsert.ok, true);
  assert.deepEqual(tools["faro.getPath"].execute({ pathId: "billing-flow" }), upsert);

  const select = tools["faro.setActivePath"].execute({ pathId: "billing-flow" });
  assert.equal(select.ok, true);
  assert.deepEqual(tools["faro.listPaths"].execute(), {
    ok: true,
    value: {
      paths: [
        {
          id: "auth-flow",
          title: "Auth Flow",
          goal: "Trace authentication",
          isActive: false,
          currentBeaconId: "b1",
          beaconCount: 2,
        },
        {
          id: "billing-flow",
          title: "Billing Flow",
          goal: "Trace authentication",
          isActive: true,
          currentBeaconId: "b1",
          beaconCount: 2,
        },
      ],
    },
  });

  assert.deepEqual(
    tools["faro.setCurrentBeacon"].execute({
      pathId: "billing-flow",
      beaconId: "missing-beacon",
    }),
    {
      ok: false,
      error: {
        code: "beacon_not_found",
        message: "Path billing-flow does not contain beacon missing-beacon.",
      },
    },
  );

  assert.deepEqual(tools["faro.deletePath"].execute({ pathId: "missing-flow" }), {
    ok: false,
    error: {
      code: "path_not_found",
      message: "Path missing-flow was not found.",
    },
  });
});

test("upsertPath returns invalid_path and preserves state for invalid input", () => {
  const tools = createFaroMcpTools({
    service: createFaroAgentService({
      store: createInMemoryStore(createDocument()),
    }),
  });
  const previousList = tools["faro.listPaths"].execute();

  assert.deepEqual(
    tools["faro.upsertPath"].execute({
      path: createPath({
        mainPath: ["missing-beacon"],
      }),
    }),
    {
      ok: false,
      error: {
        code: "invalid_path",
        message: "Path auth-flow is missing beacon missing-beacon.",
      },
    },
  );
  assert.deepEqual(tools["faro.listPaths"].execute(), previousList);
});
