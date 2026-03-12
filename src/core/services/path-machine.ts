import type { FaroDocument, FaroPath, PathPointer } from "../model/document.ts";

export function moveToNextBeacon(document: FaroDocument): FaroDocument {
  return updateActivePath(document, (path) => {
    const currentIndex = getCurrentIndex(path);
    const nextIndex = Math.min(currentIndex + 1, path.mainPath.length - 1);
    setPathCurrentByIndex(path, nextIndex);
  });
}

export function moveToPreviousBeacon(document: FaroDocument): FaroDocument {
  return updateActivePath(document, (path) => {
    const currentIndex = getCurrentIndex(path);
    const previousIndex = Math.max(currentIndex - 1, 0);
    setPathCurrentByIndex(path, previousIndex);
  });
}

export function setActivePath(document: FaroDocument, pathId: string): FaroDocument {
  const nextDocument = clone(document);
  const path = nextDocument.paths.find((entry) => entry.id === pathId);

  if (!path) {
    return nextDocument;
  }

  nextDocument.activePathId = pathId;
  path.current = normalizeCurrent(path);
  return nextDocument;
}

export function setCurrentBeacon(
  document: FaroDocument,
  pathId: string,
  beaconId: string,
): FaroDocument {
  const nextDocument = clone(document);
  const path = nextDocument.paths.find((entry) => entry.id === pathId);

  if (!path) {
    return nextDocument;
  }

  const index = path.mainPath.indexOf(beaconId);

  if (index === -1) {
    return nextDocument;
  }

  path.current = {
    mode: "main",
    index,
    beaconId,
  };

  nextDocument.activePathId = pathId;
  return nextDocument;
}

export function normalizeCurrent(path: FaroPath): PathPointer {
  const currentBeaconId = path.current?.beaconId ?? null;
  const currentIndex = currentBeaconId === null ? -1 : path.mainPath.indexOf(currentBeaconId);

  if (currentIndex !== -1) {
    return {
      mode: "main",
      index: currentIndex,
      beaconId: currentBeaconId,
    };
  }

  if (path.mainPath.length === 0) {
    return {
      mode: "main",
      index: 0,
      beaconId: null,
    };
  }

  return {
    mode: "main",
    index: 0,
    beaconId: path.mainPath[0] ?? null,
  };
}

function updateActivePath(
  document: FaroDocument,
  updater: (path: FaroPath) => void,
): FaroDocument {
  const nextDocument = clone(document);
  const path = nextDocument.paths.find((entry) => entry.id === nextDocument.activePathId);

  if (!path || path.mainPath.length === 0) {
    return nextDocument;
  }

  updater(path);
  return nextDocument;
}

function setPathCurrentByIndex(path: FaroPath, index: number): FaroPath {
  const beaconId = path.mainPath[index] ?? null;

  path.current = {
    mode: "main",
    index,
    beaconId,
  };

  return path;
}

function getCurrentIndex(path: FaroPath): number {
  const currentBeaconId = path.current?.beaconId ?? null;
  const currentIndex = currentBeaconId === null ? -1 : path.mainPath.indexOf(currentBeaconId);

  if (currentIndex !== -1) {
    return currentIndex;
  }

  return 0;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
