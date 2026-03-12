import type { RuntimeCommands } from "./commands/create-runtime-commands.ts";

type Disposable = {
  dispose(): void;
};

type CommandRegistrar = {
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;
};

export function registerRuntimeCommands({
  commands,
  runtimeCommands,
}: {
  commands: CommandRegistrar;
  runtimeCommands: RuntimeCommands;
}): Disposable {
  const registrations = [
    commands.registerCommand("faro.nextBeacon", () => runtimeCommands.nextBeacon()),
    commands.registerCommand("faro.previousBeacon", () => runtimeCommands.previousBeacon()),
    commands.registerCommand("faro.revealCurrentBeacon", () =>
      runtimeCommands.revealCurrentBeacon(),
    ),
    commands.registerCommand("faro.setActivePath", (pathId: unknown) =>
      runtimeCommands.setActivePath(String(pathId)),
    ),
    commands.registerCommand("faro.setCurrentBeacon", (pathId: unknown, beaconId: unknown) =>
      runtimeCommands.setCurrentBeacon(String(pathId), String(beaconId)),
    ),
  ];

  return {
    dispose() {
      for (const registration of registrations) {
        registration.dispose();
      }
    },
  };
}
