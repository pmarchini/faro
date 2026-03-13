import type { RevealResult } from "../reveal-result.ts";

type Controller = {
  nextBeacon(): Promise<RevealResult>;
  previousBeacon(): Promise<RevealResult>;
  setActivePath(pathId: string): Promise<RevealResult>;
  setCurrentBeacon(pathId: string, beaconId: string): Promise<RevealResult>;
  revealCurrentBeacon(): Promise<RevealResult>;
};

type Dependencies = {
  controller: Controller;
};

export type RuntimeCommands = {
  nextBeacon(): Promise<RevealResult>;
  previousBeacon(): Promise<RevealResult>;
  setActivePath(pathId: string): Promise<RevealResult>;
  setCurrentBeacon(pathId: string, beaconId: string): Promise<RevealResult>;
  revealCurrentBeacon(): Promise<RevealResult>;
};

export function createRuntimeCommands({
  controller,
}: Dependencies): RuntimeCommands {
  return {
    nextBeacon: () => controller.nextBeacon(),
    previousBeacon: () => controller.previousBeacon(),
    setActivePath: (pathId: string) => controller.setActivePath(pathId),
    setCurrentBeacon: (pathId: string, beaconId: string) =>
      controller.setCurrentBeacon(pathId, beaconId),
    revealCurrentBeacon: () => controller.revealCurrentBeacon(),
  };
}
