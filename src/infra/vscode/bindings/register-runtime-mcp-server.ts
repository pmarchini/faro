import path from "node:path";

import type { ExtensionRuntime } from "../create-extension-runtime.ts";

type Disposable = {
  dispose(): void | Promise<void>;
};

type RuntimeMcpServerHost = {
  registerMcpServerDefinitionProvider(
    id: string,
    provider: {
      provideMcpServerDefinitions(): Array<{
        label: string;
        command: string;
        args: string[];
        env: Record<string, string | number | null>;
      }>;
    },
  ): Disposable;
};

type RuntimeMcpSocketServer = Disposable & {
  readonly endpoint: {
    host: string;
    port: number;
    token: string;
  };
};

export async function registerRuntimeMcpServer({
  runtime,
  extensionPath,
  host,
  createSocketServer = defaultCreateSocketServer,
}: {
  runtime: ExtensionRuntime;
  extensionPath: string;
  host: RuntimeMcpServerHost;
  createSocketServer?: (runtime: ExtensionRuntime) => Promise<RuntimeMcpSocketServer>;
}): Promise<Disposable> {
  const socketServer = await createSocketServer(runtime);
  const serverScriptPath = path.resolve(extensionPath, "src/infra/mcp/faro-mcp-stdio-server.ts");
  const registration = host.registerMcpServerDefinitionProvider("faro.local", {
    provideMcpServerDefinitions() {
      return [
        {
          label: "Faro",
          command: process.execPath,
          args: ["--experimental-strip-types", serverScriptPath],
          env: {
            FARO_MCP_HOST: socketServer.endpoint.host,
            FARO_MCP_PORT: socketServer.endpoint.port,
            FARO_MCP_TOKEN: socketServer.endpoint.token,
          },
        },
      ];
    },
  });

  return {
    dispose() {
      registration.dispose();
      socketServer.dispose();
    },
  };
}

async function defaultCreateSocketServer(runtime: ExtensionRuntime): Promise<RuntimeMcpSocketServer> {
  const { createRuntimeMcpSocketServer } = await import(
    "../../mcp/socket/create-runtime-mcp-socket-server.ts"
  );

  return createRuntimeMcpSocketServer({
    mcp: runtime.mcp,
  });
}
