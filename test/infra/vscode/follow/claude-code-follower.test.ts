import assert from "node:assert/strict";
import test from "node:test";

import {
  createClaudeCodeFollower,
  createFollowView,
  type FollowPorts,
  type FollowView,
} from "../../../../src/infra/vscode/follow/claude-code-follower.ts";
import type { FollowSignal } from "../../../../src/core/model/follow.ts";

function signal(overrides: Partial<FollowSignal> = {}): FollowSignal {
  return {
    version: 1,
    root: "/repo",
    tourId: "login",
    tourTitle: "Login flow",
    nodeId: "persist",
    step: 2,
    total: 5,
    title: "Session is persisted",
    summary: "The session row is written.",
    anchors: [
      { file: "src/session.ts", range: { startLine: 10, endLine: 20 } },
      { file: "src/store.ts", range: { startLine: 1, endLine: 4 } },
      { file: "src/session.ts", range: { startLine: 40, endLine: 42 } },
    ],
    focus: { file: "src/session.ts", line: 14 },
    updatedAt: 1,
    ...overrides,
  };
}

function fakePorts(initial: string | null) {
  let text = initial;
  let onChange: () => void = () => undefined;
  const shown: FollowView[] = [];
  const state = { enabled: true, disposed: false, watched: "" };
  const ports: FollowPorts = {
    watch(filePath, listener) {
      state.watched = filePath;
      onChange = listener;
      return { dispose() {} };
    },
    async readText() {
      return text;
    },
    isEnabled: () => state.enabled,
    async show(view) {
      shown.push(view);
    },
    dispose() {
      state.disposed = true;
    },
  };

  return {
    ports,
    shown,
    state,
    write(next: FollowSignal | string) {
      text = typeof next === "string" ? next : JSON.stringify(next);
      onChange();
    },
  };
}

test("follow view opens the beacon's file with its anchors and centres the beacon line", () => {
  const view = createFollowView(signal(), "/workspace");

  assert.equal(view.filePath, "/repo/src/session.ts");
  assert.deepEqual(view.lines, [
    { startLine: 10, endLine: 20 },
    { startLine: 40, endLine: 42 },
  ]);
  assert.equal(view.focusLine, 14);
  assert.equal(view.status, "Faro 2/5 · Session is persisted");
});

test("follow view falls back to the first anchor and the workspace root", () => {
  const view = createFollowView(signal({ root: undefined, focus: undefined }), "/workspace");

  assert.equal(view.filePath, "/workspace/src/session.ts");
  assert.equal(view.focusLine, 10);
});

test("the follower ignores the step left from before it started and follows each new one", async () => {
  const world = fakePorts(JSON.stringify(signal()));
  const follower = createClaudeCodeFollower({ workspaceRoot: "/repo", ports: world.ports });
  await follower.ready;

  assert.equal(world.state.watched, "/repo/.faro/follow.json");
  await follower.sync();
  assert.equal(world.shown.length, 0);

  world.write(signal({ updatedAt: 2, nodeId: "store", focus: { file: "src/store.ts", line: 2 } }));
  await follower.sync();
  assert.deepEqual(
    world.shown.map((view) => view.filePath),
    ["/repo/src/store.ts"],
  );

  follower.dispose();
  assert.equal(world.state.disposed, true);
});

test("the follower skips malformed writes and does nothing when the setting is off", async () => {
  const world = fakePorts(null);
  const follower = createClaudeCodeFollower({ workspaceRoot: "/repo", ports: world.ports });
  await follower.ready;

  world.write("{ half written");
  await follower.sync();
  world.state.enabled = false;
  world.write(signal({ updatedAt: 3 }));
  await follower.sync();
  assert.equal(world.shown.length, 0);

  world.state.enabled = true;
  world.write(signal({ updatedAt: 4 }));
  await follower.sync();
  assert.equal(world.shown.length, 1);
});
