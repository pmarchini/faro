import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeEditorNavigator } from "../../src/infra/vscode/vscode-editor-navigator.ts";
import * as fixtures from "../core/fixtures.ts";

function createVscodeHost() {
  const operations: unknown[] = [];
  const editors = new Map<string, ReturnType<typeof createEditor>>();
  const decorationType = {
    dispose() {
      operations.push(["dispose-decoration"]);
    },
  };

  return {
    operations,
    decorationType,
    vscode: {
      commands: {
        registerCommand() {
          return {
            dispose() {},
          };
        },
        executeCommand() {},
      },
      Uri: {
        parse(value: string) {
          return { value };
        },
      },
      Position: class Position {
        line: number;
        character: number;

        constructor(line: number, character: number) {
          this.line = line;
          this.character = character;
        }
      },
      Range: class Range {
        start: { line: number; character: number };
        end: { line: number; character: number };

        constructor(
          start: { line: number; character: number },
          end: { line: number; character: number },
        ) {
          this.start = start;
          this.end = end;
        }
      },
      Selection: class Selection {
        anchor: { line: number; character: number };
        active: { line: number; character: number };

        constructor(
          anchor: { line: number; character: number },
          active: { line: number; character: number },
        ) {
          this.anchor = anchor;
          this.active = active;
        }
      },
      TextEditorRevealType: {
        InCenterIfOutsideViewport: "center",
      },
      workspace: {
        fs: {
          async stat(uri: { value: string }) {
            operations.push(["file-exists", uri.value]);
            return {};
          },
        },
        async openTextDocument(uri: { value: string }) {
          operations.push(["open-document", uri.value]);
          return { uri };
        },
        getConfiguration() {
          return {
            get<T>(_key: string, defaultValue: T): T {
              return defaultValue;
            },
          };
        },
      },
      window: {
        registerTreeDataProvider() {
          return {
            dispose() {},
          };
        },
        registerWebviewViewProvider() {
          return {
            dispose() {},
          };
        },
        async showTextDocument(document: { uri: { value: string } }) {
          operations.push(["show-editor", document.uri.value]);
          const editor = createEditor(document.uri.value, operations);
          editors.set(document.uri.value, editor);
          return editor;
        },
        createTextEditorDecorationType(options?: unknown) {
          operations.push(["create-decoration", options]);
          return decorationType;
        },
      },
    },
    getEditor(fileUri: string) {
      return editors.get(fileUri);
    },
  };
}

function createEditor(fileUri: string, operations: unknown[]) {
  return {
    selection: null as unknown,
    revealRange(range: unknown, revealType: unknown) {
      operations.push(["reveal-range", fileUri, range, revealType]);
    },
    setDecorations(decorationType: unknown, ranges: unknown[]) {
      operations.push(["set-decorations", fileUri, decorationType, ranges]);
    },
    setSelection(selection: unknown) {
      this.selection = selection;
      operations.push(["set-selection", fileUri, selection]);
    },
  };
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(record)) {
    result[key] = normalize(entry);
  }

  return result;
}

test("reveals and highlights a beacon through the vscode host", async () => {
  const { vscode, operations, decorationType, getEditor } = createVscodeHost();
  const navigator = createVscodeEditorNavigator({ vscode });

  const result = await navigator.revealBeacon(
    fixtures.createBeacon("b1", {
      fileUri: "file:///workspace/auth.ts",
    }),
  );

  assert.deepEqual(result, { status: "revealed", beaconId: "b1" });
  assert.deepEqual(normalize(operations), [
    [
      "create-decoration",
      {
        isWholeLine: false,
        borderWidth: "1px",
        borderStyle: "solid",
      },
    ],
    ["file-exists", "file:///workspace/auth.ts"],
    ["open-document", "file:///workspace/auth.ts"],
    ["show-editor", "file:///workspace/auth.ts"],
    [
      "reveal-range",
      "file:///workspace/auth.ts",
      {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 0 },
      },
      "center",
    ],
    [
      "set-selection",
      "file:///workspace/auth.ts",
      {
        anchor: { line: 0, character: 0 },
        active: { line: 0, character: 0 },
      },
    ],
    [
      "set-decorations",
      "file:///workspace/auth.ts",
      decorationType,
      [
        {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 },
        },
      ],
    ],
  ]);

  assert.deepEqual(normalize(getEditor("file:///workspace/auth.ts")?.selection), {
    anchor: { line: 0, character: 0 },
    active: { line: 0, character: 0 },
  });
});

test("moving to a new editor clears the previous highlight", async () => {
  const { vscode, operations, decorationType } = createVscodeHost();
  const navigator = createVscodeEditorNavigator({ vscode });

  await navigator.revealBeacon(fixtures.createBeacon("b1", { fileUri: "file:///workspace/a.ts" }));
  await navigator.revealBeacon(fixtures.createBeacon("b2", { fileUri: "file:///workspace/b.ts" }));

  assert.deepEqual(
    normalize(operations.filter((entry) => Array.isArray(entry) && entry[0] === "set-decorations")),
    [
      [
        "set-decorations",
        "file:///workspace/a.ts",
        decorationType,
        [
          {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        ],
      ],
      ["set-decorations", "file:///workspace/a.ts", decorationType, []],
      [
        "set-decorations",
        "file:///workspace/b.ts",
        decorationType,
        [
          {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        ],
      ],
    ],
  );
});

test("disposing clears the active highlight and decoration type", async () => {
  const { vscode, operations, decorationType } = createVscodeHost();
  const navigator = createVscodeEditorNavigator({ vscode });

  await navigator.revealBeacon(fixtures.createBeacon("b1", { fileUri: "file:///workspace/a.ts" }));
  navigator.dispose();

  assert.deepEqual(operations.slice(-2), [
    ["set-decorations", "file:///workspace/a.ts", decorationType, []],
    ["dispose-decoration"],
  ]);
});
