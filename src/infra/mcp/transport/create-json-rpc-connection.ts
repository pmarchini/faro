type Disposable = {
  dispose(): void;
};

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcSuccessResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

export type JsonRpcErrorResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
  };
};

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export type JsonRpcLineTransport = Disposable & {
  onMessage(listener: (line: string) => void): () => void;
  send(line: string): void;
};

export type JsonRpcConnection = Disposable;

export function createJsonRpcConnection({
  transport,
  handleRequest,
}: {
  transport: JsonRpcLineTransport;
  handleRequest(request: JsonRpcRequest): JsonRpcResponse | null | Promise<JsonRpcResponse | null>;
}): JsonRpcConnection {
  const unsubscribe = transport.onMessage((line) => {
    void handleLine(line);
  });

  return {
    dispose() {
      unsubscribe();
      transport.dispose();
    },
  };

  async function handleLine(line: string): Promise<void> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      transport.send(
        JSON.stringify(createErrorResponse(null, -32700, "Parse error")),
      );
      return;
    }

    if (!isJsonRpcRequest(parsed)) {
      transport.send(
        JSON.stringify(createErrorResponse(getResponseId(parsed), -32600, "Invalid request")),
      );
      return;
    }

    const response = await handleRequest(parsed);

    if (parsed.id === undefined || response === null) {
      return;
    }

    transport.send(JSON.stringify(response));
  }
}

function createErrorResponse(id: JsonRpcId, code: number, message: string): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function getResponseId(value: unknown): JsonRpcId {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return null;
  }

  const id = (value as { id?: unknown }).id;

  return isJsonRpcId(id) ? id : null;
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
    typeof (value as { method?: unknown }).method === "string" &&
    (!("id" in value) || isJsonRpcId((value as { id?: unknown }).id))
  );
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}
