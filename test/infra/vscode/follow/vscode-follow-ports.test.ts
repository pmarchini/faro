import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeFollowPorts } from "../../../../src/infra/vscode/follow/vscode-follow-ports.ts";
import type { VscodeLike } from "../../../../src/infra/vscode/vscode-api.ts";

test("showing a step opens a preview without taking focus, highlights it and names it in the status bar", async () => {
  const calls: unknown[][] = [];
  const threads: Array<Record<string, unknown> & { thread: Record<string, unknown> }> = [];
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
    comments: {
      createCommentController: (id: string, label: string) => ({
        createCommentThread(uri: unknown, range: unknown, comments: unknown[]) {
          const thread = { canReply: true, label: "", collapsibleState: "collapsed", dispose() {} };
          threads.push({ id, label, uri, range, comments, thread });
          return thread;
        },
        dispose() {},
      }),
    },
    MarkdownString: function (value: string) {
      return { markdown: value };
    },
    CommentMode: { Preview: "preview" },
    CommentThreadCollapsibleState: { Expanded: "expanded" },
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
    beaconLabel: "persist()",
    note: "**2/5 · Session is persisted**",
    status: "Faro 2/5 · Session is persisted",
    tooltip: "",
  });

  assert.deepEqual(calls[0], ["show", { uri: "file:///repo/src/session.ts" }, { preserveFocus: true, preview: true }]);
  assert.deepEqual(
    calls.slice(1).map((call) => call[0]),
    ["decorate", "decorate", "reveal"],
  );
  assert.deepEqual(calls[1]?.[2], [{ start: { line: 9, character: 0 }, end: { line: 19, character: 0 } }]);
  const focus = { start: { line: 13, character: 0 }, end: { line: 13, character: 0 } };
  assert.deepEqual(calls[2]?.[2], [
    {
      range: focus,
      hoverMessage: { markdown: "**2/5 · Session is persisted**" },
      renderOptions: { after: { contentText: "◂ persist()" } },
    },
  ]);

  assert.equal(threads.length, 1);
  assert.deepEqual(threads[0]?.range, focus);
  assert.deepEqual(threads[0]?.comments, [
    { body: { markdown: "**2/5 · Session is persisted**" }, mode: "preview", author: { name: "Faro" } },
  ]);
  assert.deepEqual(
    { canReply: threads[0]?.thread.canReply, state: threads[0]?.thread.collapsibleState },
    { canReply: false, state: "expanded" },
  );
  assert.equal(status.text, "$(eye) Faro 2/5 · Session is persisted");
  assert.equal(status.shown, true);
  ports.dispose();
});
