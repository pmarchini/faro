import { createPathTraversalService } from "../../app/path/path-traversal-service.ts";
import type { Beacon } from "../../core/model/document.ts";
import type { InMemoryStore } from "../../core/services/in-memory-store.ts";
import type { RevealResult } from "./reveal-result.ts";

type Dependencies = {
  store: Pick<InMemoryStore, "load" | "replaceDocument">;
  revealBeacon(beacon: Beacon): Promise<RevealResult>;
};

export function createCommandController({ store, revealBeacon }: Dependencies) {
  const pathTraversal = createPathTraversalService({ store });

  return {
    nextBeacon,
    previousBeacon,
    setActivePath: selectActivePath,
    setCurrentBeacon: selectCurrentBeacon,
    revealCurrentBeacon,
  };

  async function nextBeacon(): Promise<RevealResult> {
    pathTraversal.nextBeacon();
    return revealCurrentBeacon();
  }

  async function previousBeacon(): Promise<RevealResult> {
    pathTraversal.previousBeacon();
    return revealCurrentBeacon();
  }

  async function selectActivePath(pathId: string): Promise<RevealResult> {
    pathTraversal.setActivePath(pathId);
    return revealCurrentBeacon();
  }

  async function selectCurrentBeacon(pathId: string, beaconId: string): Promise<RevealResult> {
    pathTraversal.setCurrentBeacon(pathId, beaconId);
    return revealCurrentBeacon();
  }

  async function revealCurrentBeacon(): Promise<RevealResult> {
    const beacon = pathTraversal.getCurrentBeacon();

    if (!beacon) {
      return { status: "idle" };
    }

    return revealBeacon(beacon);
  }
}
