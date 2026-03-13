import type { FaroDocument, FaroPath } from "../../core/model/document.ts";

export type FaroAgentStore = {
  load: () => FaroDocument;
  upsertPath: (path: FaroPath) => FaroDocument;
  setActivePath: (pathId: string) => FaroDocument;
  setCurrentBeacon: (pathId: string, beaconId: string) => FaroDocument;
  deletePath: (pathId: string) => FaroDocument;
};

export type FaroPathSummary = {
  id: string;
  title: string;
  goal: string;
  isActive: boolean;
  currentBeaconId: string | null;
  beaconCount: number;
};

export type DeletePathResult = {
  deleted: boolean;
  activePathId: string | null;
};

export type FaroAgentService = {
  listPaths: () => FaroPathSummary[];
  getPath: (pathId: string) => FaroPath | null;
  upsertPath: (path: FaroPath) => FaroPath | null;
  setActivePath: (pathId: string) => FaroPath | null;
  setCurrentBeacon: (pathId: string, beaconId: string) => FaroPath | null;
  deletePath: (pathId: string) => DeletePathResult;
};

export function createFaroAgentService({
  store,
}: {
  store: FaroAgentStore;
}): FaroAgentService {
  return {
    listPaths,
    getPath,
    upsertPath,
    setActivePath,
    setCurrentBeacon,
    deletePath,
  };

  function listPaths(): FaroPathSummary[] {
    const document = store.load();

    return document.paths.map((path) => ({
      id: path.id,
      title: path.title ?? path.id,
      goal: path.goal ?? "",
      isActive: document.activePathId === path.id,
      currentBeaconId: path.current?.beaconId ?? null,
      beaconCount: path.mainPath.length,
    }));
  }

  function getPath(pathId: string): FaroPath | null {
    return findPath(store.load(), pathId);
  }

  function upsertPath(path: FaroPath): FaroPath | null {
    return findPath(store.upsertPath(path), path.id);
  }

  function setActivePath(pathId: string): FaroPath | null {
    const document = store.setActivePath(pathId);

    if (document.activePathId !== pathId) {
      return null;
    }

    return findPath(document, pathId);
  }

  function setCurrentBeacon(pathId: string, beaconId: string): FaroPath | null {
    const document = store.setCurrentBeacon(pathId, beaconId);
    const path = findPath(document, pathId);

    if (!path || path.current?.beaconId !== beaconId) {
      return null;
    }

    return path;
  }

  function deletePath(pathId: string): DeletePathResult {
    const previousDocument = store.load();
    const nextDocument = store.deletePath(pathId);

    return {
      deleted: previousDocument.paths.some((path) => path.id === pathId),
      activePathId: nextDocument.activePathId,
    };
  }
}

function findPath(document: FaroDocument, pathId: string): FaroPath | null {
  return document.paths.find((path) => path.id === pathId) ?? null;
}
