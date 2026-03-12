import assert from "node:assert/strict";
import test from "node:test";

import { assertValidDocument, isValidFileUri, isValidRange } from "../../src/core/model/validation.ts";
import { createDocument, createPath } from "./fixtures.ts";

test("accepts a minimal valid path document", () => {
  assert.doesNotThrow(() => {
    assertValidDocument(createDocument());
  });
});

test("rejects a path with a missing active path", () => {
  assert.throws(() => {
    assertValidDocument(
      createDocument({
        activePathId: "missing-path",
      }),
    );
  }, /activePathId/);
});

test("rejects a path with a current beacon outside the path index", () => {
  assert.throws(() => {
    assertValidDocument({
      schemaVersion: 1,
      activePathId: "auth-flow",
      paths: [
        createPath({
          current: {
            mode: "main",
            index: 0,
            beaconId: "b3",
          },
        }),
      ],
    });
  }, /current beacon/);
});

test("rejects invalid file uris", () => {
  assert.equal(isValidFileUri("file:///workspace/app.ts"), true);
  assert.equal(isValidFileUri("/workspace/app.ts"), false);
});

test("rejects inverted ranges", () => {
  assert.equal(
    isValidRange({
      startLine: 10,
      startColumn: 1,
      endLine: 9,
      endColumn: 1,
    }),
    false,
  );
});
