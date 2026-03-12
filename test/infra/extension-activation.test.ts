import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryStore } from "../../src/core/services/in-memory-store.ts";
import { activate, deactivate } from "../../src/infra/vscode/extension.ts";
import type {
  CreateExtensionRuntimeOptions,
  ExtensionRuntime,
} from "../../src/infra/vscode/create-extension-runtime.ts";
import * as fixtures from "../core/fixtures.ts";

type Disposable = {
  dispose(): void;
};

function createWorkspaceState() {
  return {
    get() {
      return undefined;
    },
    update() {
      return Promise.resolve();
    },
  };
}

function createHost() {
  const operations: unknown[] = [];
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  const views = new Map<string, unknown>();
  const decorationType = {
    dispose() {
      operations.push(["dispose-decoration"]);
    },
  };

  return {
    operations,
    commands,
    views,
    host: {
      commands: {
        registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
          commands.set(id, handler);
          return {
            dispose() {
              commands.delete(id);
            },
          };
        },
      },
      window: {
        registerTreeDataProvider(id: string, provider: unknown): Disposable {
          views.set(id, provider);
          return {
            dispose() {
              views.delete(id);
            },
          };
        },
        registerWebviewViewProvider(id: string, provider: unknown): Disposable {
          views.set(id, provider);
          return {
            dispose() {
              views.delete(id);
            },
          };
        },
        async showTextDocument(document: { uri: { value: string } }) {
          operations.push(["show-editor", document.uri.value]);
          return {
            revealRange(range: unknown, revealType: unknown) {
              operations.push(["reveal-range", document.uri.value, range, revealType]);
            },
            setDecorations(type: unknown, ranges: unknown[]) {
              operations.push(["set-decorations", document.uri.value, type, ranges]);
            },
            setSelection(selection: unknown) {
              operations.push(["set-selection", document.uri.value, selection]);
            },
          };
        },
        createTextEditorDecorationType(): Disposable {
          operations.push(["create-decoration"]);
          return decorationType;
        },
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
    },
  };
}

test("activate registers the full faro UI surface through the injected host", async () => {
  const subscriptions: Disposable[] = [];
  const workspaceState = createWorkspaceState();
  const { host, commands, views } = createHost();

  const runtime = await activate(
    { subscriptions, workspaceState },
    {
      runtimeFactory: (): ExtensionRuntime => ({
        status: "ready",
        store: createInMemoryStore(fixtures.createDocument()),
        commands: {
          nextBeacon: async () => ({ status: "idle" }),
          previousBeacon: async () => ({ status: "idle" }),
          setActivePath: async () => ({ status: "idle" }),
          setCurrentBeacon: async () => ({ status: "idle" }),
          revealCurrentBeacon: async () => ({ status: "idle" }),
        },
        subscribeToRefresh() {
          return () => {};
        },
        refresh() {},
        dispose() {},
      }),
      loadVscodeApi: async () => host as never,
    },
  );

  assert.equal(runtime.status, "ready");
  assert.equal(subscriptions.length, 2);
  assert.deepEqual([...commands.keys()], [
    "faro.nextBeacon",
    "faro.previousBeacon",
    "faro.revealCurrentBeacon",
    "faro.setActivePath",
    "faro.setCurrentBeacon",
  ]);
  assert.deepEqual([...views.keys()], ["faro.outline", "faro.navigator"]);

  deactivate();
});

test("activate passes workspace state and editor-backed reveal to the runtime factory", async () => {
  const subscriptions: Disposable[] = [];
  const workspaceState = createWorkspaceState();
  const { host, operations, commands } = createHost();
  let receivedOptions: unknown;

  await activate(
    { subscriptions, workspaceState },
    {
      runtimeFactory: (options?: CreateExtensionRuntimeOptions): ExtensionRuntime => {
        receivedOptions = options;

        return {
          status: "ready",
          store: createInMemoryStore(fixtures.createDocument()),
          commands: {
            nextBeacon: async () => ({ status: "idle" }),
            previousBeacon: async () => ({ status: "idle" }),
            setActivePath: async () => ({ status: "idle" }),
            setCurrentBeacon: async () => ({ status: "idle" }),
            revealCurrentBeacon: async () => {
              await options?.revealBeacon?.(
                fixtures.createBeacon("b1", {
                  fileUri: "file:///workspace/auth.ts",
                }),
              );
              return { status: "idle" };
            },
          },
          subscribeToRefresh() {
            return () => {};
          },
          refresh() {},
          dispose() {},
        };
      },
      loadVscodeApi: async () => host as never,
    },
  );

  const runtimeOptions = receivedOptions as {
    workspaceState: unknown;
    revealBeacon?(beacon: ReturnType<typeof fixtures.createBeacon>): Promise<unknown>;
  };

  assert.equal(runtimeOptions.workspaceState, workspaceState);
  assert.equal(typeof runtimeOptions.revealBeacon, "function");

  await commands.get("faro.revealCurrentBeacon")?.();
  deactivate();

  assert.match(JSON.stringify(operations), /open-document/);
});
