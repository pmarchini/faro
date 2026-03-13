import assert from "node:assert/strict";
import test from "node:test";

import {
  createJsonRpcConnection,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../../../../src/infra/mcp/transport/create-json-rpc-connection.ts";

test("json-rpc connection parses requests, delegates handling, and writes framed responses", async () => {
  const transport = createFakeLineTransport();
  const handled: JsonRpcRequest[] = [];

  createJsonRpcConnection({
    transport,
    async handleRequest(request) {
      handled.push(request);

      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          acknowledged: request.method,
        },
      };
    },
  });

  transport.receive(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
      },
    }),
  );

  await flush();

  assert.deepEqual(handled, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
      },
    },
  ]);
  assert.deepEqual(transport.sent.map(parseJson), [
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        acknowledged: "initialize",
      },
    },
  ]);
});

test("json-rpc connection returns parse and invalid-request errors without invoking the handler", async () => {
  const transport = createFakeLineTransport();
  let handled = 0;

  createJsonRpcConnection({
    transport,
    handleRequest() {
      handled += 1;
      return {
        jsonrpc: "2.0",
        id: null,
        result: {},
      };
    },
  });

  transport.receive("{invalid json}");
  transport.receive(JSON.stringify({ id: "abc", method: 42 }));

  await flush();

  assert.equal(handled, 0);
  assert.deepEqual(transport.sent.map(parseJson), [
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error",
      },
    },
    {
      jsonrpc: "2.0",
      id: "abc",
      error: {
        code: -32600,
        message: "Invalid request",
      },
    },
  ]);
});

test("json-rpc connection does not respond to notifications and disposes the underlying transport", async () => {
  const transport = createFakeLineTransport();
  let disposed = false;

  transport.dispose = () => {
    disposed = true;
  };

  const connection = createJsonRpcConnection({
    transport,
    handleRequest() {
      return {
        jsonrpc: "2.0",
        id: null,
        result: {
          ok: true,
        },
      };
    },
  });

  transport.receive(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  );
  await flush();

  assert.deepEqual(transport.sent, []);

  connection.dispose();
  assert.equal(disposed, true);
});

function createFakeLineTransport(): {
  readonly sent: string[];
  onMessage(listener: (line: string) => void): () => void;
  send(line: string): void;
  dispose(): void;
  receive(line: string): void;
} {
  let listener: ((line: string) => void) | null = null;
  const sent: string[] = [];

  return {
    sent,
    onMessage(nextListener) {
      listener = nextListener;

      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    },
    send(line) {
      sent.push(line);
    },
    dispose() {},
    receive(line) {
      listener?.(line);
    },
  };
}

function parseJson(line: string): JsonRpcResponse {
  return JSON.parse(line) as JsonRpcResponse;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
