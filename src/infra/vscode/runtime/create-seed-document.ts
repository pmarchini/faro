import type { FaroDocument } from "../../../core/model/document.ts";

export function createSeedDocument(): FaroDocument {
  return {
    schemaVersion: 1,
    activePathId: "sample-flow",
    paths: [
      {
        id: "sample-flow",
        title: "Sample Flow",
        goal: "Bootstrap the first Faro runtime",
        mainPath: ["b1", "b2"],
        branches: [],
        current: {
          mode: "main",
          index: 0,
          beaconId: "b1",
        },
        beacons: {
          b1: {
            id: "b1",
            title: "Runtime entrypoint",
            fileUri: "file:///workspace/src/infra/vscode/extension.ts",
            range: {
              startLine: 1,
              startColumn: 1,
              endLine: 24,
              endColumn: 1,
            },
            summary: "Extension activation starts here.",
            explanation: "This is the root of the current Faro runtime wiring.",
            tags: ["entrypoint"],
            children: [],
          },
          b2: {
            id: "b2",
            title: "Command controller",
            fileUri: "file:///workspace/src/infra/vscode/command-controller.ts",
            range: {
              startLine: 1,
              startColumn: 1,
              endLine: 56,
              endColumn: 1,
            },
            summary: "Command orchestration lives here.",
            explanation: "The runtime delegates navigation commands to this controller.",
            tags: ["controller"],
            children: [],
          },
        },
      },
    ],
  };
}
