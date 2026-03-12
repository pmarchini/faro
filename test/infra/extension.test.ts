import assert from "node:assert/strict";
import test from "node:test";

import { activate, deactivate } from "../../src/infra/vscode/extension.ts";

test("activate registers the runtime in the extension subscriptions", () => {
  const subscriptions: Array<{ dispose(): void }> = [];

  const runtime = activate({ subscriptions });

  assert.equal(runtime.status, "ready");
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0], runtime);

  deactivate();
});
