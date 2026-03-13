import { randomUUID } from "node:crypto";
import net from "node:net";

import { createFaroMcpProtocolServer } from "../create-faro-mcp-protocol-server.ts";
import type { FaroMcpResources } from "../create-faro-mcp-resources.ts";
import type { FaroMcpToolSet } from "../create-faro-mcp-tools.ts";
import { createJsonRpcConnection } from "../transport/create-json-rpc-connection.ts";
import { createStdioLineTransport } from "../transport/create-stdio-line-transport.ts";

type Disposable = {
  dispose(): Promise<void>;
};

export type RuntimeMcpSocketServer = Disposable & {
  readonly endpoint: {
    host: string;
    port: number;
    token: string;
  };
};

export async function createRuntimeMcpSocketServer({
  mcp,
}: {
  mcp: {
    tools: FaroMcpToolSet;
    resources: FaroMcpResources;
  };
}): Promise<RuntimeMcpSocketServer> {
  const token = randomUUID();
  const protocolServer = createFaroMcpProtocolServer({ mcp });
  const server = net.createServer((socket) => {
    const transport = createStdioLineTransport({
      input: socket,
      output: socket,
    });
    let connection: ReturnType<typeof createJsonRpcConnection> | null = null;

    const unsubscribe = transport.onMessage((line) => {
      if (line !== JSON.stringify({ token })) {
        unsubscribe();
        transport.dispose();
        socket.destroy();
        return;
      }

      unsubscribe();
      connection = createJsonRpcConnection({
        transport,
        handleRequest(request) {
          return protocolServer.handleMessage(request);
        },
      });
    });

    socket.on("close", () => {
      connection?.dispose();
      transport.dispose();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Could not resolve runtime MCP socket address.");
  }

  return {
    endpoint: {
      host: "127.0.0.1",
      port: address.port,
      token,
    },
    async dispose() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
