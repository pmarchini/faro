import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{
      command: string;
      title: string;
    }>;
    viewsContainers?: {
      activitybar?: Array<{
        id: string;
      }>;
    };
    views?: Record<string, Array<{ id: string }>>;
  };
};

function loadPackageManifest(): PackageManifest {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(directory, "../../package.json");

  return JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
}

test("package manifest contributes the full faro UI and command surface", () => {
  const manifest = loadPackageManifest();

  assert.deepEqual(
    manifest.contributes?.viewsContainers?.activitybar?.map((container) => container.id),
    ["faro"],
  );
  assert.deepEqual(
    manifest.contributes?.views?.faro?.map((view) => view.id),
    ["faro.outline", "faro.navigator"],
  );
  assert.deepEqual(
    manifest.contributes?.commands?.map((command) => command.command),
    [
      "faro.nextBeacon",
      "faro.previousBeacon",
      "faro.revealCurrentBeacon",
      "faro.setActivePath",
      "faro.setCurrentBeacon",
    ],
  );
  assert.deepEqual(
    manifest.activationEvents,
    [
      "onView:faro.outline",
      "onView:faro.navigator",
      "onCommand:faro.nextBeacon",
      "onCommand:faro.previousBeacon",
      "onCommand:faro.revealCurrentBeacon",
      "onCommand:faro.setActivePath",
      "onCommand:faro.setCurrentBeacon",
    ],
  );
});
