import assert from "node:assert/strict";
import test from "node:test";

import { createVscodeFollowPorts, gitUri } from "../../../../src/infra/vscode/follow/vscode-follow-ports.ts";
import type { FollowView } from "../../../../src/infra/vscode/follow/claude-code-follower.ts";
import type { VscodeLike } from "../../../../src/infra/vscode/vscode-api.ts";

const VIEW: FollowView = {
  filePath: "/repo/src/session.ts",
  lines: [{ startLine: 10, endLine: 20 }],
  focusLine: 14,
  beacons: [
    { line: 14, label: "persist()", isCurrent: true },
    { line: 18, label: "x".repeat(80), isCurrent: false },
  ],
  noteLabel: "faro · 2 Session is persisted",
  note: "**2/5 · Session is persisted**",
  status: "faro 2/5",
  tooltip: "",
};

function fakeVscode({ hasDiffEditor = true } = {}) {
  const calls: unknown[][] = [];
  const threads: Array<{ range: unknown; comments: unknown[]; thread: Record<string, unknown> }> = [];
  const editor = {
    document: { uri: "file:///repo/src/session.ts" },
    setDecorations: (type: { name: string }, ranges: unknown[]) => calls.push(["decorate", type.name, ranges]),
    revealRange: (range: unknown) => calls.push(["reveal", range]),
  };
  const names = ["anchor", "beacon", "focus"];
  const vscode = {
    commands: {
      async executeCommand(...args: unknown[]) {
        calls.push(["command", ...args]);
      },
    },
    window: {
      createTextEditorDecorationType: () => ({ name: names.shift(), dispose() {} }),
      visibleTextEditors: hasDiffEditor ? [editor] : [],
      async showTextDocument(document: unknown, options: unknown) {
        calls.push(["show", document, options]);
        return editor;
      },
    },
    comments: {
      createCommentController: () => ({
        createCommentThread(_uri: unknown, range: unknown, comments: unknown[]) {
          const thread = { canReply: true, label: "", collapsibleState: "expanded", dispose() {} };
          threads.push({ range, comments, thread });
          return thread;
        },
        dispose() {},
      }),
    },
    MarkdownString: function (value: string) {
      return { markdown: value };
    },
    CommentMode: { Preview: "preview" },
    CommentThreadCollapsibleState: { Expanded: "expanded", Collapsed: "collapsed" },
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

  return { vscode, calls, threads };
}

const line = (number: number) => ({ start: { line: number - 1, character: 0 }, end: { line: number - 1, character: 0 } });

test("a code step opens a preview without focus, marks its beacons and pins a collapsed note", async () => {
  const { vscode, calls, threads } = fakeVscode();
  const ports = createVscodeFollowPorts({ vscode });
  assert.equal(ports.isEnabled(), true);

  await ports.show(VIEW);

  assert.deepEqual(calls[0], ["show", { uri: "file:///repo/src/session.ts" }, { preserveFocus: true, preview: true }]);
  assert.deepEqual(calls[1], ["decorate", "anchor", [{ start: line(10).start, end: line(20).end }]]);
  assert.deepEqual(calls[2], [
    "decorate",
    "beacon",
    [{ range: line(18), hoverMessage: "x".repeat(80), renderOptions: { after: { contentText: `◂ ${"x".repeat(59)}…` } } }],
  ]);
  assert.deepEqual(calls[3], [
    "decorate",
    "focus",
    [{ range: line(14), hoverMessage: "persist()", renderOptions: { after: { contentText: "◂ persist()" } } }],
  ]);
  assert.deepEqual(calls[4], ["reveal", line(14)]);

  assert.equal(threads.length, 1);
  assert.deepEqual(threads[0]?.range, line(14));
  assert.deepEqual(threads[0]?.comments, [
    { body: { markdown: "**2/5 · Session is persisted**" }, mode: "preview", author: { name: "Faro" } },
  ]);
  assert.deepEqual(threads[0]?.thread, {
    canReply: false,
    label: "faro · 2 Session is persisted",
    collapsibleState: "collapsed",
    dispose: threads[0]?.thread.dispose,
  });
  ports.dispose();
});

test("a diff step opens a diff against the tour's base and decorates its modified side", async () => {
  const { vscode, calls } = fakeVscode();
  const ports = createVscodeFollowPorts({ vscode });

  await ports.show({ ...VIEW, diffBase: "HEAD" });

  assert.deepEqual(calls[0], [
    "command",
    "vscode.diff",
    gitUri("/repo/src/session.ts", "HEAD"),
    "file:///repo/src/session.ts",
    "session.ts ↔ HEAD (faro 2/5)",
    { preserveFocus: true, preview: true },
  ]);
  assert.equal(calls[1]?.[0], "decorate");
  assert.equal(gitUri("/repo/a b.ts", "HEAD"), `git:/repo/a%20b.ts?${encodeURIComponent('{"path":"/repo/a b.ts","ref":"HEAD"}')}`);
  ports.dispose();
});

test("a diff step falls back to the plain file when no diff editor appears", async () => {
  const { vscode, calls } = fakeVscode({ hasDiffEditor: false });
  const ports = createVscodeFollowPorts({ vscode });

  await ports.show({ ...VIEW, diffBase: "HEAD" });

  assert.deepEqual(
    calls.slice(0, 2).map((call) => call[0]),
    ["command", "show"],
  );
  ports.dispose();
});
