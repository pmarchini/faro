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

test("rejects a path with a current index that does not match the current beacon", () => {
  assert.throws(() => {
    assertValidDocument({
      schemaVersion: 1,
      activePathId: "auth-flow",
      paths: [
        createPath({
          current: {
            mode: "main",
            index: 1,
            beaconId: "b1",
          },
        }),
      ],
    });
  }, /current index/);
});

test("rejects a path whose beacon id does not match the beacon map key", () => {
  assert.throws(() => {
    assertValidDocument({
      schemaVersion: 1,
      activePathId: "auth-flow",
      paths: [
        createPath({
          beacons: {
            b1: {
              ...createPath().beacons.b1,
              id: "different-id",
            },
            b2: createPath().beacons.b2,
          },
        }),
      ],
    });
  }, /beacon id must match key/);
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
