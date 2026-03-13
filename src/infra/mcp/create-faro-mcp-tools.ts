import type {
  DeletePathResult,
  FaroAgentService,
  FaroPathSummary,
} from "../../app/agent/create-faro-agent-service.ts";
import type { FaroPath } from "../../core/model/document.ts";

type ReadOnlyHint = true | false;

export type FaroMcpError = {
  code: "invalid_path" | "path_not_found" | "beacon_not_found";
  message: string;
};

export type FaroMcpToolResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: FaroMcpError;
    };

export type FaroMcpTool<Input, Output> = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
  readOnlyHint: ReadOnlyHint;
  execute: (input: Input) => FaroMcpToolResult<Output>;
};

export type FaroMcpToolSet = {
  "faro.listPaths": FaroMcpTool<void, { paths: FaroPathSummary[] }>;
  "faro.getPath": FaroMcpTool<{ pathId: string }, { path: FaroPath }>;
  "faro.upsertPath": FaroMcpTool<{ path: FaroPath }, { path: FaroPath }>;
  "faro.setActivePath": FaroMcpTool<{ pathId: string }, { path: FaroPath }>;
  "faro.setCurrentBeacon": FaroMcpTool<
    { pathId: string; beaconId: string },
    { path: FaroPath }
  >;
  "faro.deletePath": FaroMcpTool<{ pathId: string }, DeletePathResult>;
};

export function createFaroMcpTools({
  service,
}: {
  service: FaroAgentService;
}): FaroMcpToolSet {
  return {
    "faro.listPaths": {
      name: "faro.listPaths",
      description: "List the Faro paths available in the current workspace.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
      },
      readOnlyHint: true,
      execute: () => ({
        ok: true,
        value: {
          paths: service.listPaths(),
        },
      }),
    },
    "faro.getPath": {
      name: "faro.getPath",
      description: "Load one Faro path by id.",
      inputSchema: {
        type: "object",
        properties: {
          pathId: { type: "string" },
        },
        required: ["pathId"],
        additionalProperties: false,
      },
      readOnlyHint: true,
      execute: ({ pathId }) => {
        const path = service.getPath(pathId);

        if (!path) {
          return notFound(pathId);
        }

        return {
          ok: true,
          value: { path },
        };
      },
    },
    "faro.upsertPath": {
      name: "faro.upsertPath",
      description: "Create or replace one Faro path.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
      readOnlyHint: false,
      execute: ({ path }) => {
        try {
          const storedPath = service.upsertPath(path);

          if (!storedPath) {
            return invalidPath("Path could not be persisted.");
          }

          return {
            ok: true,
            value: { path: storedPath },
          };
        } catch (error) {
          return invalidPath(getErrorMessage(error));
        }
      },
    },
    "faro.setActivePath": {
      name: "faro.setActivePath",
      description: "Set the active Faro path.",
      inputSchema: {
        type: "object",
        properties: {
          pathId: { type: "string" },
        },
        required: ["pathId"],
        additionalProperties: false,
      },
      readOnlyHint: false,
      execute: ({ pathId }) => {
        const path = service.setActivePath(pathId);

        if (!path) {
          return notFound(pathId);
        }

        return {
          ok: true,
          value: { path },
        };
      },
    },
    "faro.setCurrentBeacon": {
      name: "faro.setCurrentBeacon",
      description: "Set the current Faro beacon in a path.",
      inputSchema: {
        type: "object",
        properties: {
          pathId: { type: "string" },
          beaconId: { type: "string" },
        },
        required: ["pathId", "beaconId"],
        additionalProperties: false,
      },
      readOnlyHint: false,
      execute: ({ pathId, beaconId }) => {
        const existingPath = service.getPath(pathId);

        if (!existingPath) {
          return notFound(pathId);
        }

        const path = service.setCurrentBeacon(pathId, beaconId);

        if (!path) {
          return {
            ok: false,
            error: {
              code: "beacon_not_found",
              message: `Path ${pathId} does not contain beacon ${beaconId}.`,
            },
          };
        }

        return {
          ok: true,
          value: { path },
        };
      },
    },
    "faro.deletePath": {
      name: "faro.deletePath",
      description: "Delete one Faro path.",
      inputSchema: {
        type: "object",
        properties: {
          pathId: { type: "string" },
        },
        required: ["pathId"],
        additionalProperties: false,
      },
      readOnlyHint: false,
      execute: ({ pathId }) => {
        if (!service.getPath(pathId)) {
          return notFound(pathId);
        }

        return {
          ok: true,
          value: service.deletePath(pathId),
        };
      },
    },
  };
}

function notFound(pathId: string): FaroMcpToolResult<never> {
  return {
    ok: false,
    error: {
      code: "path_not_found",
      message: `Path ${pathId} was not found.`,
    },
  };
}

function invalidPath(message: string): FaroMcpToolResult<never> {
  return {
    ok: false,
    error: {
      code: "invalid_path",
      message,
    },
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error.";
}
