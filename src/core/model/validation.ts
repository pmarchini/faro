import type { Beacon, BeaconRange, FaroDocument, FaroPath } from "./document.ts";

export function assertValidDocument(document: FaroDocument): void {
  if (!document || typeof document !== "object") {
    throw new Error("Document must be an object.");
  }

  if (document.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1.");
  }

  if (!Array.isArray(document.paths)) {
    throw new Error("paths must be an array.");
  }

  const pathIds = new Set<string>();

  for (const path of document.paths) {
    assertValidPath(path);

    if (pathIds.has(path.id)) {
      throw new Error(`Duplicate path id: ${path.id}`);
    }

    pathIds.add(path.id);
  }

  if (
    document.activePathId !== null &&
    !document.paths.some((path) => path.id === document.activePathId)
  ) {
    throw new Error("activePathId must refer to an existing path.");
  }
}

function assertValidPath(path: FaroPath): void {
  if (!path || typeof path !== "object") {
    throw new Error("Path must be an object.");
  }

  if (typeof path.id !== "string" || path.id.length === 0) {
    throw new Error("Path id is required.");
  }

  if (!Array.isArray(path.mainPath)) {
    throw new Error(`Path ${path.id} mainPath must be an array.`);
  }

  if (!path.beacons || typeof path.beacons !== "object") {
    throw new Error(`Path ${path.id} beacons must be an object.`);
  }

  for (const beaconId of path.mainPath) {
    const beacon = path.beacons[beaconId];

    if (!beacon) {
      throw new Error(`Path ${path.id} is missing beacon ${beaconId}.`);
    }

    assertValidBeacon(beacon);
  }

  for (const [beaconKey, beacon] of Object.entries(path.beacons)) {
    assertValidBeacon(beacon);

    if (beacon.id !== beaconKey) {
      throw new Error(`Path ${path.id} beacon id must match key ${beaconKey}.`);
    }
  }

  const currentBeaconId = path.current?.beaconId ?? null;

  if (currentBeaconId !== null) {
    if (!path.mainPath.includes(currentBeaconId)) {
      throw new Error(`Path ${path.id} current beacon must be in mainPath.`);
    }

    if (!path.beacons[currentBeaconId]) {
      throw new Error(`Path ${path.id} current beacon must exist in beacons.`);
    }

    const currentIndex = path.mainPath.indexOf(currentBeaconId);

    if (path.current?.index !== currentIndex) {
      throw new Error(`Path ${path.id} current index must match current beacon.`);
    }
  }
}

function assertValidBeacon(beacon: Beacon): void {
  if (typeof beacon.id !== "string" || beacon.id.length === 0) {
    throw new Error("Beacon id is required.");
  }

  if (!isValidFileUri(beacon.fileUri)) {
    throw new Error(`Beacon ${beacon.id} must use a valid file URI.`);
  }

  if (!isValidRange(beacon.range)) {
    throw new Error(`Beacon ${beacon.id} must use a valid range.`);
  }
}

export function isValidFileUri(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "file:";
  } catch {
    return false;
  }
}

export function isValidRange(range: unknown): boolean {
  if (!range || typeof range !== "object") {
    return false;
  }

  const { startLine, startColumn, endLine, endColumn } = range as BeaconRange;
  const allIntegers = [startLine, startColumn, endLine, endColumn].every(
    (value) => Number.isInteger(value) && value >= 1,
  );

  if (!allIntegers) {
    return false;
  }

  if (endLine < startLine) {
    return false;
  }

  if (endLine === startLine && endColumn < startColumn) {
    return false;
  }

  return true;
}
