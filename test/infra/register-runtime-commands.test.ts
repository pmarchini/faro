import assert from "node:assert/strict";
import test from "node:test";

import { registerRuntimeCommands } from "../../src/infra/vscode/register-runtime-commands.ts";

test("registers the public faro command surface", () => {
  const registrations: Array<{
    id: string;
    handler: (...args: unknown[]) => unknown;
  }> = [];
  const runtimeCommands = {
    nextBeacon: async () => ({ status: "idle" as const }),
    previousBeacon: async () => ({ status: "idle" as const }),
    revealCurrentBeacon: async () => ({ status: "idle" as const }),
    setActivePath: async () => ({ status: "idle" as const }),
    setCurrentBeacon: async () => ({ status: "idle" as const }),
  };

  const registration = registerRuntimeCommands({
    commands: {
      registerCommand(id, handler) {
        registrations.push({ id, handler });
        return {
          dispose() {},
        };
      },
    },
    runtimeCommands,
  });

  assert.deepEqual(
    registrations.map((entry) => entry.id),
    [
      "faro.nextBeacon",
      "faro.previousBeacon",
      "faro.revealCurrentBeacon",
      "faro.setActivePath",
      "faro.setCurrentBeacon",
    ],
  );

  registration.dispose();
});

test("invoking registered commands delegates to the runtime command surface", async () => {
  const calls: unknown[] = [];
  const registrations = new Map<string, (...args: unknown[]) => unknown>();
  const runtimeCommands = {
    nextBeacon: async () => {
      calls.push(["nextBeacon"]);
      return { status: "idle" as const };
    },
    previousBeacon: async () => {
      calls.push(["previousBeacon"]);
      return { status: "idle" as const };
    },
    revealCurrentBeacon: async () => {
      calls.push(["revealCurrentBeacon"]);
      return { status: "idle" as const };
    },
    setActivePath: async (pathId: string) => {
      calls.push(["setActivePath", pathId]);
      return { status: "idle" as const };
    },
    setCurrentBeacon: async (pathId: string, beaconId: string) => {
      calls.push(["setCurrentBeacon", pathId, beaconId]);
      return { status: "idle" as const };
    },
  };

  registerRuntimeCommands({
    commands: {
      registerCommand(id, handler) {
        registrations.set(id, handler);
        return {
          dispose() {},
        };
      },
    },
    runtimeCommands,
  });

  await registrations.get("faro.nextBeacon")?.();
  await registrations.get("faro.previousBeacon")?.();
  await registrations.get("faro.revealCurrentBeacon")?.();
  await registrations.get("faro.setActivePath")?.("auth-flow");
  await registrations.get("faro.setCurrentBeacon")?.("auth-flow", "b2");

  assert.deepEqual(calls, [
    ["nextBeacon"],
    ["previousBeacon"],
    ["revealCurrentBeacon"],
    ["setActivePath", "auth-flow"],
    ["setCurrentBeacon", "auth-flow", "b2"],
  ]);
});

test("disposing unregisters all command handlers", () => {
  const disposed: string[] = [];

  const registration = registerRuntimeCommands({
    commands: {
      registerCommand(id) {
        return {
          dispose() {
            disposed.push(id);
          },
        };
      },
    },
    runtimeCommands: {
      nextBeacon: async () => ({ status: "idle" as const }),
      previousBeacon: async () => ({ status: "idle" as const }),
      revealCurrentBeacon: async () => ({ status: "idle" as const }),
      setActivePath: async () => ({ status: "idle" as const }),
      setCurrentBeacon: async () => ({ status: "idle" as const }),
    },
  });

  registration.dispose();

  assert.deepEqual(disposed, [
    "faro.nextBeacon",
    "faro.previousBeacon",
    "faro.revealCurrentBeacon",
    "faro.setActivePath",
    "faro.setCurrentBeacon",
  ]);
});
