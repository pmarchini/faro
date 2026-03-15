import type { Beacon, FaroDocument } from "../../core/model/document.ts";
import type { InMemoryStore } from "../../core/services/in-memory-store.ts";
import * as pathMachine from "../../core/services/path-machine.ts";

type PathStore = Pick<InMemoryStore, "load" | "replaceDocument">;

export type PathTraversalService = {
  nextBeacon(): Beacon | null;
  previousBeacon(): Beacon | null;
  setActivePath(pathId: string): Beacon | null;
  setCurrentBeacon(pathId: string, beaconId: string): Beacon | null;
  getCurrentBeacon(): Beacon | null;
};

export function createPathTraversalService({
  store,
}: {
  store: PathStore;
}): PathTraversalService {
  return {
    nextBeacon() {
      store.replaceDocument(pathMachine.moveToNextBeacon(store.load()));
      return getCurrentBeacon(store.load());
    },
    previousBeacon() {
      store.replaceDocument(pathMachine.moveToPreviousBeacon(store.load()));
      return getCurrentBeacon(store.load());
    },
    setActivePath(pathId: string) {
      store.replaceDocument(pathMachine.setActivePath(store.load(), pathId));
      return getCurrentBeacon(store.load());
    },
    setCurrentBeacon(pathId: string, beaconId: string) {
      store.replaceDocument(pathMachine.setCurrentBeacon(store.load(), pathId, beaconId));
      return getCurrentBeacon(store.load());
    },
    getCurrentBeacon() {
      return getCurrentBeacon(store.load());
    },
  };
}

function getCurrentBeacon(document: FaroDocument): Beacon | null {
  const activePath = document.paths.find((path) => path.id === document.activePathId);
  const beaconId = activePath?.current?.beaconId ?? null;

  if (!activePath || !beaconId) {
    return null;
  }

  return activePath.beacons[beaconId] ?? null;
}
