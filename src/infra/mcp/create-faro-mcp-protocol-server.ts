import type { FaroMcpResources } from "./create-faro-mcp-resources.ts";
import type { FaroMcpToolSet } from "./create-faro-mcp-tools.ts";

const FARO_MCP_PROTOCOL_VERSION = "2025-03-26";
const FARO_MCP_SERVER_NAME = "faro";
const FARO_MCP_SERVER_VERSION = "0.0.1";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
  };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

type McpSurface = {
  tools: FaroMcpToolSet;
  resources: FaroMcpResources;
};

export function createFaroMcpProtocolServer({
  mcp,
}: {
  mcp: McpSurface;
}) {
  return {
    handleMessage,
  };

  function handleMessage(message: JsonRpcRequest): JsonRpcResponse | null {
    switch (message.method) {
      case "initialize":
        return success(message.id ?? null, {
          protocolVersion: FARO_MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
            resources: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: FARO_MCP_SERVER_NAME,
            version: FARO_MCP_SERVER_VERSION,
          },
        });
      case "notifications/initialized":
        return null;
      case "ping":
        return success(message.id ?? null, {});
      case "tools/list":
        return success(message.id ?? null, {
          tools: Object.values(mcp.tools).map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
              readOnlyHint: tool.readOnlyHint,
            },
          })),
        });
      case "tools/call":
        return handleToolCall(message.id ?? null, message.params);
      case "resources/list":
        return success(message.id ?? null, {
          resources: mcp.resources.list(),
        });
      case "resources/read":
        return handleResourceRead(message.id ?? null, message.params);
      default:
        return error(message.id ?? null, -32601, `Method not found: ${message.method}`);
    }
  }

  function handleToolCall(id: JsonRpcId, params: unknown): JsonRpcResponse {
    if (!params || typeof params !== "object") {
      return error(id, -32602, "Invalid params for tools/call.");
    }

    const { name, arguments: toolArguments } = params as {
      name?: unknown;
      arguments?: unknown;
    };

    if (typeof name !== "string") {
      return error(id, -32602, "Invalid params for tools/call.");
    }

    const tool = mcp.tools[name as keyof FaroMcpToolSet];

    if (!tool) {
      return error(id, -32602, `Unknown tool: ${name}`);
    }

    const result = tool.execute(toolArguments as never);

    return success(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
      structuredContent: result,
      isError: result.ok === false,
    });
  }

  function handleResourceRead(id: JsonRpcId, params: unknown): JsonRpcResponse {
    if (!params || typeof params !== "object") {
      return error(id, -32602, "Invalid params for resources/read.");
    }

    const uri = (params as { uri?: unknown }).uri;

    if (typeof uri !== "string") {
      return error(id, -32602, "Invalid params for resources/read.");
    }

    const resource = mcp.resources.read(uri);

    if (!resource) {
      return error(id, -32002, `Resource not found: ${uri}`);
    }

    return success(id, {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: JSON.stringify(resource.contents),
        },
      ],
    });
  }
}

function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}
