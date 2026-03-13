import type { FaroAgentService } from "../../app/agent/create-faro-agent-service.ts";

export type FaroMcpResource =
  | {
      uri: "faro://paths";
      mimeType: "application/json";
      contents: ReturnType<FaroAgentService["listPaths"]>;
    }
  | {
      uri: `faro://paths/${string}`;
      mimeType: "application/json";
      contents: NonNullable<ReturnType<FaroAgentService["getPath"]>>;
    };

export type FaroMcpResources = {
  read: (uri: string) => FaroMcpResource | null;
};

export function createFaroMcpResources({
  service,
}: {
  service: FaroAgentService;
}): FaroMcpResources {
  return {
    read(uri: string): FaroMcpResource | null {
      if (uri === "faro://paths") {
        return {
          uri: "faro://paths",
          mimeType: "application/json",
          contents: service.listPaths(),
        };
      }

      const pathId = getPathId(uri);

      if (!pathId) {
        return null;
      }

      const path = service.getPath(pathId);

      if (!path) {
        return null;
      }

      return {
        uri: `faro://paths/${pathId}`,
        mimeType: "application/json",
        contents: path,
      };
    },
  };
}

function getPathId(uri: string): string | null {
  const prefix = "faro://paths/";

  if (!uri.startsWith(prefix)) {
    return null;
  }

  const pathId = uri.slice(prefix.length);

  return pathId.length > 0 ? pathId : null;
}
