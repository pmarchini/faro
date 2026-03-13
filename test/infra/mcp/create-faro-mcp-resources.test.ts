import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../../src/core/services/in-memory-store.ts";
import { createFaroMcpResources } from "../../../src/infra/mcp/create-faro-mcp-resources.ts";
import { createDocument } from "../../core/fixtures.ts";

test("resources expose path summaries and canonical path payloads", () => {
  const resources = createFaroMcpResources({
    service: createFaroAgentService({
      store: createInMemoryStore(createDocument()),
    }),
  });

  assert.deepEqual(resources.read("faro://paths"), {
    uri: "faro://paths",
    mimeType: "application/json",
    contents: [
      {
        id: "auth-flow",
        title: "Auth Flow",
        goal: "Trace authentication",
        isActive: true,
        currentBeaconId: "b1",
        beaconCount: 2,
      },
    ],
  });
  const pathResource = resources.read("faro://paths/auth-flow");

  assert.ok(pathResource);
  assert.equal(pathResource.uri, "faro://paths/auth-flow");
  assert.equal(pathResource.contents.id, "auth-flow");
});

test("resources return null for unknown or unsupported uris", () => {
  const resources = createFaroMcpResources({
    service: createFaroAgentService({
      store: createInMemoryStore(createDocument()),
    }),
  });

  assert.equal(resources.read("faro://paths/missing-flow"), null);
  assert.equal(resources.read("faro://unsupported"), null);
});
