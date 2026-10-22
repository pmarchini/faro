import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeFollowPorts } from "../../../../src/infra/vscode/follow/vscode-follow-ports.ts";
import type { VscodeLike } from "../../../../src/infra/vscode/vscode-api.ts";

test("showing a step opens a preview without taking focus, highlights it and names it in the status bar", async () => {
  const calls: unknown[][] = [];
  const status = {
    text: "",
    tooltip: "",
    shown: false,
    show() {
      status.shown = true;
    },
    dispose() {},
  };
  const vscode = {
    window: {
      createTextEditorDecorationType: (options: unknown) => ({ options, dispose() {} }),
      createStatusBarItem: () => status,
      async showTextDocument(document: unknown, options: unknown) {
        calls.push(["show", document, options]);
        return {
          setDecorations: (type: { options: { backgroundColor: string } }, ranges: unknown[]) =>
            calls.push(["decorate", type.options.backgroundColor, ranges]),
          revealRange: (range: unknown) => calls.push(["reveal", range]),
        };
      },
    },
    workspace: {
      openTextDocument: async (uri: unknown) => ({ uri }),
      getConfiguration: () => ({ get: <T>(_key: string, value: T) => value }),
    },
    Uri: { parse: (value: string) => value },
    Position: function (line: number, character: number) {
      return { line, character };
    },
    Range: function (start: unknown, end: unknown) {
      return { start, end };
    },
    TextEditorRevealType: { InCenterIfOutsideViewport: "center" },
  } as unknown as VscodeLike;

  const ports = createVscodeFollowPorts({ vscode });
  assert.equal(ports.isEnabled(), true);

  await ports.show({
    filePath: "/repo/src/session.ts",
    lines: [{ startLine: 10, endLine: 20 }],
    focusLine: 14,
    status: "Faro 2/5 · Session is persisted",
    tooltip: "",
  });

  assert.deepEqual(calls[0], ["show", { uri: "file:///repo/src/session.ts" }, { preserveFocus: true, preview: true }]);
  assert.deepEqual(
    calls.slice(1).map((call) => call[0]),
    ["decorate", "decorate", "reveal"],
  );
  assert.deepEqual(calls[1]?.[2], [{ start: { line: 9, character: 0 }, end: { line: 19, character: 0 } }]);
  assert.deepEqual(calls[2]?.[2], [{ start: { line: 13, character: 0 }, end: { line: 13, character: 0 } }]);
  assert.equal(status.text, "$(eye) Faro 2/5 · Session is persisted");
  assert.equal(status.shown, true);
  ports.dispose();
});
