import assert from "node:assert/strict";
import test from "node:test";

import { createFollowSignal, parseFollowSignal } from "../../src/core/model/follow.ts";
import { createNode, createTour } from "./tour-fixtures.ts";

test("the follow signal names the current step and its beacon", () => {
  const tour = createTour({ current: { nodeId: "n2", depth: 0 } });
  const signal = createFollowSignal(tour, { beaconIndex: 0, root: "/repo", now: 5 });

  assert.deepEqual(signal, {
    version: 1,
    root: "/repo",
    tourId: "session-persistence",
    tourTitle: "Session persistence",
    nodeId: "n2",
    step: 2,
    total: 3,
    title: "Step n2",
    summary: "What happens in n2",
    anchors: [{ file: "src/n2.ts", range: { startLine: 1, endLine: 10 } }],
    focus: { file: "src/n2.ts", line: 3 },
    updatedAt: 5,
  });
});

test("the follow signal cycles beacons and leaves focus out when there are none", () => {
  const twoBeacons = createNode("n1", {
    beacons: [
      { label: "a", file: "src/n1.ts", line: 2 },
      { label: "b", file: "src/n1.ts", line: 8 },
    ],
  });
  const tour = createTour({ nodes: { ...createTour().nodes, n1: twoBeacons } });

  assert.equal(createFollowSignal(tour, { beaconIndex: 3, now: 0 })?.focus?.line, 8);

  const none = createTour({ nodes: { ...createTour().nodes, n1: createNode("n1", { beacons: [] }) } });
  assert.equal(createFollowSignal(none, { beaconIndex: 0, now: 0 })?.focus, undefined);
});

test("no follow signal when the reader is on no node", () => {
  assert.equal(createFollowSignal(createTour({ current: { nodeId: null, depth: 0 } }), { beaconIndex: 0, now: 0 }), null);
});

test("parse round-trips a signal and ignores anything malformed", () => {
  const signal = createFollowSignal(createTour(), { beaconIndex: 0, now: 1 });

  assert.deepEqual(parseFollowSignal(JSON.stringify(signal)), signal);
  assert.equal(parseFollowSignal('{"version": 1, "tourId": "x"'), null);
  assert.equal(parseFollowSignal(JSON.stringify({ ...signal, version: 2 })), null);
  assert.equal(parseFollowSignal(JSON.stringify({ ...signal, anchors: [] })), null);
  assert.equal(parseFollowSignal(JSON.stringify({ ...signal, focus: { file: "a.ts", line: 0 } })), null);
});
