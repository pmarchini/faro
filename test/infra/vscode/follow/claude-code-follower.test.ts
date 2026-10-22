import assert from "node:assert/strict";
import test from "node:test";

import {
  HEARTBEAT_MS,
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
    beaconIndex: 0,
    beacons: [
      { label: "persist()", file: "src/session.ts", line: 14 },
      { label: "put()", file: "src/store.ts", line: 2 },
      { label: "refresh()", file: "src/session.ts", line: 41 },
    ],
    steps: [
      { nodeId: "login", title: "Login request enters" },
      { nodeId: "persist", title: "Session is persisted" },
    ],
    note: { plan: "write-through", lens: "flow" },
    updatedAt: 1,
    ...overrides,
  };
}

function fakePorts(initial: string | null) {
  let text = initial;
  let onChange: () => void = () => undefined;
  let tick: () => void = () => undefined;
  const shown: FollowView[] = [];
  const writes: Array<{ path: string; value: Record<string, unknown> }> = [];
  const state = { enabled: true, disposed: false, watched: "", now: 1_000 };
  const ports: FollowPorts = {
    watch(filePath, listener) {
      state.watched = filePath;
      onChange = listener;
      return { dispose() {} };
    },
    every(ms, listener) {
      assert.equal(ms, HEARTBEAT_MS);
      tick = listener;
      return { dispose() {} };
    },
    async readText() {
      return text;
    },
    async writeText(path, value) {
      writes.push({ path, value: JSON.parse(value) });
    },
    now: () => state.now,
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
    writes,
    state,
    beat: () => tick(),
    write(next: FollowSignal | string) {
      text = typeof next === "string" ? next : JSON.stringify(next);
      onChange();
    },
  };
}

test("the view opens the current beacon's file, marks its beacons there and names the step", () => {
  const view = createFollowView(signal({ diffBase: "HEAD" }), "/workspace");

  assert.equal(view.filePath, "/repo/src/session.ts");
  assert.equal(view.diffBase, "HEAD");
  assert.deepEqual(view.lines, [
    { startLine: 10, endLine: 20 },
    { startLine: 40, endLine: 42 },
  ]);
  assert.equal(view.focusLine, 14);
  assert.deepEqual(view.beacons, [
    { line: 14, label: "persist()", isCurrent: true },
    { line: 41, label: "refresh()", isCurrent: false },
  ]);
  assert.equal(view.status, "faro 2/5");
  assert.equal(view.noteLabel, "faro · 2 Session is persisted");
  assert.equal(view.note, "**2/5 · Session is persisted**\n\n_write-through_ · full story in Claude Code");
});

test("the view moves to the next beacon's file when the beacon index moves", () => {
  const view = createFollowView(signal({ beaconIndex: 1, focus: { file: "src/store.ts", line: 2 } }), "/workspace");

  assert.equal(view.filePath, "/repo/src/store.ts");
  assert.deepEqual(view.lines, [{ startLine: 1, endLine: 4 }]);
  assert.deepEqual(view.beacons, [{ line: 2, label: "put()", isCurrent: true }]);
});

test("the view falls back to the first anchor and the workspace root", () => {
  const view = createFollowView(signal({ root: undefined, focus: undefined, beaconIndex: undefined }), "/workspace");

  assert.equal(view.filePath, "/workspace/src/session.ts");
  assert.equal(view.focusLine, 10);
  assert.equal(view.diffBase, undefined);
});

test("the follower ignores the step left from before it started and follows each new one", async () => {
  const world = fakePorts(JSON.stringify(signal()));
  const follower = createClaudeCodeFollower({ workspaceRoot: "/repo", ports: world.ports });
  const followed: string[] = [];
  follower.onDidFollow((next) => followed.push(next.nodeId));
  await follower.ready;

  assert.equal(world.state.watched, "/repo/.faro/follow.json");
  await follower.sync();
  assert.equal(world.shown.length, 0);
  assert.equal(follower.current(), null);

  world.write(signal({ updatedAt: 2, nodeId: "store", focus: { file: "src/store.ts", line: 2 } }));
  await follower.sync();
  assert.deepEqual(
    world.shown.map((view) => view.filePath),
    ["/repo/src/store.ts"],
  );
  assert.deepEqual(followed, ["store"]);
  assert.equal(follower.current()?.nodeId, "store");

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

test("the follower acks each step, beats while it follows, and goes quiet after half an hour", async () => {
  const world = fakePorts(null);
  const follower = createClaudeCodeFollower({ workspaceRoot: "/repo", ports: world.ports });
  await follower.ready;

  world.beat();
  await follower.sync();
  assert.equal(world.writes.length, 0, "no beat before a step is followed");

  world.write(signal({ updatedAt: 5 }));
  await follower.sync();
  assert.deepEqual(world.writes.at(-1), { path: "/repo/.faro/ack.json", value: { version: 1, updatedAt: 5, at: 1_000 } });

  world.state.now = 4_000;
  world.beat();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(world.writes.length, 2);

  world.state.now = 1_000 + 31 * 60_000;
  world.beat();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(world.writes.length, 2);
});

test("next, back and step requests go to control.json for the followed tour", async () => {
  const world = fakePorts(null);
  const follower = createClaudeCodeFollower({ workspaceRoot: "/repo", ports: world.ports });
  await follower.ready;

  await follower.request("next");
  assert.equal(world.writes.length, 0, "nothing to move before a tour is followed");

  world.write(signal({ updatedAt: 6 }));
  await follower.sync();
  await follower.request("next");
  await follower.request("step", "login");

  const controls = world.writes.filter((write) => write.path === "/repo/.faro/control.json").map((write) => write.value);
  assert.deepEqual(controls, [
    { version: 1, id: "1000-1", tourId: "login", action: "next" },
    { version: 1, id: "1000-2", tourId: "login", action: "step", nodeId: "login" },
  ]);
});
