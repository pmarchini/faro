import type { Beacon, FaroDocument, FaroPath } from "../../src/core/model/document.ts";

type BeaconOverrides = Partial<Beacon>;
type PathOverrides = Partial<FaroPath>;
type DocumentOverrides = Partial<FaroDocument>;

export function createBeacon(id: string, overrides: BeaconOverrides = {}): Beacon {
  return {
    id,
    title: `Beacon ${id}`,
    fileUri: `file:///workspace/${id}.ts`,
    range: {
      startLine: 1,
      startColumn: 1,
      endLine: 2,
      endColumn: 1,
    },
    summary: `Summary for ${id}`,
    explanation: `Explanation for ${id}`,
    tags: [],
    children: [],
    ...overrides,
  };
}

export function createPath(overrides: PathOverrides = {}): FaroPath {
  const beaconOne = createBeacon("b1");
  const beaconTwo = createBeacon("b2");

  return {
    id: "auth-flow",
    title: "Auth Flow",
    goal: "Trace authentication",
    mainPath: ["b1", "b2"],
    branches: [],
    current: {
      mode: "main",
      index: 0,
      beaconId: "b1",
    },
    beacons: {
      b1: beaconOne,
      b2: beaconTwo,
    },
    ...overrides,
  };
}

export function createDocument(overrides: DocumentOverrides = {}): FaroDocument {
  return {
    schemaVersion: 1,
    activePathId: "auth-flow",
    paths: [createPath()],
    ...overrides,
  };
}
