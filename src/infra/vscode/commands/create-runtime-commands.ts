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
  notifyRefresh(): void;
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
  notifyRefresh,
}: Dependencies): RuntimeCommands {
  return {
    nextBeacon: runWithRefresh(() => controller.nextBeacon()),
    previousBeacon: runWithRefresh(() => controller.previousBeacon()),
    setActivePath: (pathId: string) => runWithRefresh(() => controller.setActivePath(pathId))(),
    setCurrentBeacon: (pathId: string, beaconId: string) =>
      runWithRefresh(() => controller.setCurrentBeacon(pathId, beaconId))(),
    revealCurrentBeacon: runWithRefresh(() => controller.revealCurrentBeacon()),
  };

  function runWithRefresh<T>(action: () => Promise<T>) {
    return async () => {
      const result = await action();
      notifyRefresh();
      return result;
    };
  }
}
