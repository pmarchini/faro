import assert from "node:assert/strict";
import test from "node:test";

import { FOLLOW_COMMANDS, createFollowStepTree } from "../../../../src/infra/vscode/follow/register-follow-ui.ts";
import type { FollowSignal } from "../../../../src/core/model/follow.ts";

test("the step tree lists the followed tour's steps, marks the current one, and each moves the tour", () => {
  let current: FollowSignal | null = null;
  const tree = createFollowStepTree({ current: () => current });
  let refreshed = 0;
  tree.onDidChangeTreeData(() => (refreshed += 1));

  assert.deepEqual(tree.getChildren(), []);

  current = {
    version: 1,
    tourId: "login",
    tourTitle: "Login flow",
    nodeId: "persist",
    step: 2,
    total: 2,
    title: "Session is persisted",
    summary: "",
    anchors: [{ file: "a.ts", range: { startLine: 1, endLine: 2 } }],
    steps: [
      { nodeId: "login", title: "Login request enters" },
      { nodeId: "persist", title: "Session is persisted" },
    ],
    updatedAt: 1,
  };
  tree.refresh();

  const items = tree.getChildren().map((step) => tree.getTreeItem(step));
  assert.equal(refreshed, 1);
  assert.deepEqual(
    items.map((item) => item.label),
    ["  1 Login request enters", "▸ 2 Session is persisted"],
  );
  assert.deepEqual(items[0]?.command, { command: FOLLOW_COMMANDS.step, title: "Faro: Go to Step", arguments: ["login"] });
});
