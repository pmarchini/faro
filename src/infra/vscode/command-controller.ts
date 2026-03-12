import type { Beacon, FaroDocument } from "../../core/model/document.ts";
import type { InMemoryStore } from "../../core/services/in-memory-store.ts";
import * as pathMachine from "../../core/services/path-machine.ts";
import type { RevealResult } from "./reveal-result.ts";

type Dependencies = {
  store: Pick<InMemoryStore, "load" | "replaceDocument">;
  revealBeacon(beacon: Beacon): Promise<RevealResult>;
};

export function createCommandController({ store, revealBeacon }: Dependencies) {
  return {
    nextBeacon,
    previousBeacon,
    setActivePath: selectActivePath,
    setCurrentBeacon: selectCurrentBeacon,
    revealCurrentBeacon,
  };

  async function nextBeacon(): Promise<RevealResult> {
    const nextDocument = pathMachine.moveToNextBeacon(store.load());
    store.replaceDocument(nextDocument);
    return revealCurrentBeacon();
  }

  async function previousBeacon(): Promise<RevealResult> {
    const nextDocument = pathMachine.moveToPreviousBeacon(store.load());
    store.replaceDocument(nextDocument);
    return revealCurrentBeacon();
  }

  async function selectActivePath(pathId: string): Promise<RevealResult> {
    const nextDocument = pathMachine.setActivePath(store.load(), pathId);
    store.replaceDocument(nextDocument);
    return revealCurrentBeacon();
  }

  async function selectCurrentBeacon(pathId: string, beaconId: string): Promise<RevealResult> {
    const nextDocument = pathMachine.setCurrentBeacon(store.load(), pathId, beaconId);
    store.replaceDocument(nextDocument);
    return revealCurrentBeacon();
  }

  async function revealCurrentBeacon(): Promise<RevealResult> {
    const beacon = getCurrentBeacon(store.load());

    if (!beacon) {
      return { status: "idle" };
    }

    return revealBeacon(beacon);
  }
}

function getCurrentBeacon(document: FaroDocument): Beacon | null {
  const activePath = document.paths.find((path) => path.id === document.activePathId);
  const beaconId = activePath?.current?.beaconId ?? null;

  if (!activePath || !beaconId) {
    return null;
  }

  return activePath.beacons[beaconId] ?? null;
}
