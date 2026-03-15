import assert from "node:assert/strict";
import test from "node:test";

import type { FaroDocument } from "../../../src/core/model/document.ts";
import { createWorkspaceStateStore } from "../../../src/infra/vscode/workspace-state-store.ts";
import * as fixtures from "../../core/fixtures.ts";

function createMemento(initialValue: FaroDocument | undefined) {
  let storedValue = initialValue;

  return {
    get(key: string) {
      return key === "faro.document" ? storedValue : undefined;
    },
    update(key: string, value: FaroDocument) {
      if (key === "faro.document") {
        storedValue = value;
      }

      return Promise.resolve();
    },
    snapshot(): FaroDocument | undefined {
      return storedValue;
    },
  };
}

test("restores a saved document", () => {
  const memento = createMemento(fixtures.createDocument());

  const store = createWorkspaceStateStore({
    memento,
    initialDocument: {
      schemaVersion: 1,
      activePathId: null,
      paths: [],
    },
  });

  assert.equal(store.load().activePathId, "auth-flow");
});

test("persists after upsert", () => {
  const memento = createMemento(undefined);
  const store = createWorkspaceStateStore({
    memento,
    initialDocument: {
      schemaVersion: 1,
      activePathId: null,
      paths: [],
    },
  });

  store.upsertPath(fixtures.createPath());

  const snapshot = memento.snapshot();

  assert.equal(snapshot?.activePathId, "auth-flow");
  assert.equal(snapshot?.paths.length, 1);
});

test("invalid saved document falls back to the initial document", () => {
  const memento = createMemento({
    schemaVersion: 1,
    activePathId: "missing-path",
    paths: [],
  });

  const store = createWorkspaceStateStore({
    memento,
    initialDocument: fixtures.createDocument(),
  });

  assert.equal(store.load().activePathId, "auth-flow");
});

test("stored placeholder workspace uris are migrated to the current initial document", () => {
  const memento = createMemento({
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
  });

  const store = createWorkspaceStateStore({
    memento,
    initialDocument: {
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
              fileUri: "file:///Users/pietro.marchini/Projects/OSS/faro/src/infra/vscode/extension.ts",
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
              fileUri:
                "file:///Users/pietro.marchini/Projects/OSS/faro/src/infra/vscode/command-controller.ts",
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
    },
  });

  assert.equal(
    store.load().paths[0]?.beacons.b1.fileUri,
    "file:///Users/pietro.marchini/Projects/OSS/faro/src/infra/vscode/extension.ts",
  );
  assert.equal(
    memento.snapshot()?.paths[0]?.beacons.b1.fileUri,
    "file:///Users/pietro.marchini/Projects/OSS/faro/src/infra/vscode/extension.ts",
  );
});
