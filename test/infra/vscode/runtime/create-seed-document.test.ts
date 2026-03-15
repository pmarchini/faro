import assert from "node:assert/strict";
import test from "node:test";

import { createSeedDocument } from "../../../../src/infra/vscode/runtime/create-seed-document.ts";

test("seed document defaults to placeholder workspace uris", () => {
  const document = createSeedDocument();

  assert.equal(
    document.paths[0]?.beacons.b1.fileUri,
    "file:///workspace/src/infra/vscode/extension.ts",
  );
  assert.equal(
    document.paths[0]?.beacons.b2.fileUri,
    "file:///workspace/src/infra/vscode/command-controller.ts",
  );
});

test("seed document uses the provided workspace root uri", () => {
  const document = createSeedDocument({
    workspaceRootUri: "file:///Users/pietro.marchini/Projects/OSS/faro",
  });

  assert.equal(
    document.paths[0]?.beacons.b1.fileUri,
    "file:///Users/pietro.marchini/Projects/OSS/faro/src/infra/vscode/extension.ts",
  );
  assert.equal(
    document.paths[0]?.beacons.b2.fileUri,
    "file:///Users/pietro.marchini/Projects/OSS/faro/src/infra/vscode/command-controller.ts",
  );
});
