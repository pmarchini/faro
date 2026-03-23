import assert from "node:assert/strict";
import test from "node:test";

import {
  isMainMessage,
  mainMessage,
  mainMessageType,
} from "../../../../../src/infra/vscode/ui/main-view/main-view-contract.ts";

test("main view protocol exposes canonical message types and builders", () => {
  assert.equal(mainMessageType.openHome, "main.openHome");
  assert.deepEqual(mainMessage.openHome(), { type: mainMessageType.openHome });
  assert.deepEqual(mainMessage.selectBeacon("auth-flow", "b1"), {
    type: mainMessageType.selectBeacon,
    pathId: "auth-flow",
    beaconId: "b1",
  });
  assert.equal(isMainMessage(mainMessage.openSetup()), true);
  assert.equal(isMainMessage({ type: mainMessageType.setupSetScope, scope: "workspace" }), false);
});
