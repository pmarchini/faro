import assert from "node:assert/strict";
import test from "node:test";

import { createFaroAgentService } from "../../../src/app/agent/create-faro-agent-service.ts";
import { createInMemoryStore } from "../../../src/core/services/in-memory-store.ts";
import { createFaroMcpResources } from "../../../src/infra/mcp/create-faro-mcp-resources.ts";
import { createFaroMcpProtocolServer } from "../../../src/infra/mcp/create-faro-mcp-protocol-server.ts";
import { createFaroMcpTools } from "../../../src/infra/mcp/create-faro-mcp-tools.ts";
import { createDocument, createPath } from "../../core/fixtures.ts";

function createServer() {
  const service = createFaroAgentService({
    store: createInMemoryStore(createDocument()),
  });

  return createFaroMcpProtocolServer({
    mcp: {
      tools: createFaroMcpTools({ service }),
      resources: createFaroMcpResources({ service }),
    },
  });
}

test("initialize returns capabilities and server metadata", () => {
  const server = createServer();

  assert.deepEqual(
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
      },
    }),
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {
            listChanged: false,
          },
          resources: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "faro",
          version: "0.0.1",
        },
      },
    },
  );
});

test("tools/list, tools/call, resources/list, and resources/read use the existing Faro MCP bootstrap", () => {
  const server = createServer();

  const toolsList = server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  assert.equal(toolsList?.jsonrpc, "2.0");
  assert.equal(toolsList?.id, 1);
  assert.ok(toolsList && "result" in toolsList);
  const listedTools = (toolsList.result as { tools: Array<{ name: string }> }).tools;
  assert.deepEqual(listedTools.map((tool) => tool.name), [
    "faro.listPaths",
    "faro.getPath",
    "faro.upsertPath",
    "faro.setActivePath",
    "faro.setCurrentBeacon",
    "faro.deletePath",
  ]);

  const upsert = server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "faro.upsertPath",
      arguments: {
        path: createPath({
          id: "billing-flow",
          title: "Billing Flow",
        }),
      },
    },
  });
  assert.equal(upsert?.jsonrpc, "2.0");
  assert.equal(upsert?.id, 2);
  assert.ok(upsert && "result" in upsert);
  const upsertResult = upsert.result as {
    content: Array<{ text?: string }>;
    isError?: boolean;
  };
  assert.equal(JSON.parse(upsertResult.content[0]?.text ?? "{}").value.path.id, "billing-flow");
  assert.equal(upsertResult.isError ?? false, false);

  const resourcesList = server.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "resources/list",
  });
  assert.equal(resourcesList?.jsonrpc, "2.0");
  assert.equal(resourcesList?.id, 3);
  assert.ok(resourcesList && "result" in resourcesList);
  const listedResources = (resourcesList.result as { resources: Array<{ uri: string }> }).resources;
  assert.equal(listedResources.some((resource) => resource.uri === "faro://paths"), true);
  assert.equal(
    listedResources.some((resource) => resource.uri === "faro://paths/billing-flow"),
    true,
  );

  const pathResource = server.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "resources/read",
    params: {
      uri: "faro://paths/billing-flow",
    },
  });
  assert.equal(pathResource?.jsonrpc, "2.0");
  assert.equal(pathResource?.id, 4);
  assert.ok(pathResource && "result" in pathResource);
  const readResult = pathResource.result as {
    contents: Array<{ text?: string }>;
  };
  assert.equal(JSON.parse(readResult.contents[0]?.text ?? "{}").id, "billing-flow");
});

test("invalid tool input becomes an MCP tool error and unknown methods return method-not-found", () => {
  const server = createServer();

  assert.deepEqual(
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "faro.upsertPath",
        arguments: {
          path: createPath({
            mainPath: ["missing-beacon"],
          }),
        },
      },
    }),
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: {
                code: "invalid_path",
                message: "Path auth-flow is missing beacon missing-beacon.",
              },
            }),
          },
        ],
        structuredContent: {
          ok: false,
          error: {
            code: "invalid_path",
            message: "Path auth-flow is missing beacon missing-beacon.",
          },
        },
        isError: true,
      },
    },
  );

  assert.deepEqual(
    server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "faro.unsupported",
    }),
    {
      jsonrpc: "2.0",
      id: 2,
      error: {
        code: -32601,
        message: "Method not found: faro.unsupported",
      },
    },
  );
});

test("initialized notification is accepted without a response", () => {
  const server = createServer();

  assert.equal(
    server.handleMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
    null,
  );
});
