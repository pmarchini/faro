import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createExtensionRuntime } from "../../../../src/infra/vscode/create-extension-runtime.ts";
import { registerRuntimeMcpServer } from "../../../../src/infra/vscode/bindings/register-runtime-mcp-server.ts";

test("registerRuntimeMcpServer registers one Faro stdio MCP definition provider", async () => {
  const runtime = createExtensionRuntime();
  const registrations: Array<{
    id: string;
    provider: {
      provideMcpServerDefinitions(): Array<{
        label: string;
        command: string;
        args: string[];
        env: Record<string, string | number | null>;
      }>;
    };
  }> = [];

  const disposable = await registerRuntimeMcpServer({
    runtime,
    extensionPath: "/workspace/faro",
    host: {
      registerMcpServerDefinitionProvider(id, provider) {
        registrations.push({ id, provider });
        return {
          dispose() {},
        };
      },
    },
    createSocketServer: async () => ({
      endpoint: {
        host: "127.0.0.1",
        port: 4319,
        token: "test-token",
      },
      dispose() {},
    }),
  });

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0]?.id, "faro.local");

  const definition = registrations[0]?.provider.provideMcpServerDefinitions()[0];
  assert.ok(definition);
  assert.equal(definition.label, "Faro");
  assert.equal(definition.command, process.execPath);
  assert.deepEqual(definition.args, [
    "--experimental-strip-types",
    path.resolve("/workspace/faro", "src/infra/mcp/faro-mcp-stdio-server.ts"),
  ]);
  assert.equal(definition.env.FARO_MCP_PORT, 4319);
  assert.equal(definition.env.FARO_MCP_TOKEN, "test-token");

  disposable.dispose();
  runtime.dispose();
});
