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
    menus?: {
      "view/title"?: Array<{
        command: string;
        when?: string;
      }>;
    };
    viewsContainers?: {
      activitybar?: Array<{
        id: string;
      }>;
    };
    views?: Record<string, Array<{ id: string; when?: string }>>;
    mcpServerDefinitionProviders?: Array<{
      id: string;
      label: string;
    }>;
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
    manifest.contributes?.views?.faro?.map((view) => ({
      id: view.id,
      when: view.when,
    })),
    [
      { id: "faro.home", when: "faro.activeView == home" },
      { id: "faro.path", when: "faro.activeView == path" },
      { id: "faro.setup", when: "faro.activeView == setup" },
    ],
  );
  assert.deepEqual(manifest.contributes?.mcpServerDefinitionProviders, [
    {
      id: "faro.local",
      label: "Faro",
    },
  ]);
  assert.deepEqual(
    manifest.contributes?.commands?.map((command) => command.command),
    [
      "faro.focusSidebar",
      "faro.showHome",
      "faro.showPath",
      "faro.showSetup",
      "faro.nextBeacon",
      "faro.previousBeacon",
      "faro.revealCurrentBeacon",
      "faro.setActivePath",
      "faro.setCurrentBeacon",
    ],
  );
  assert.deepEqual(
    manifest.contributes?.menus?.["view/title"]?.map((item) => item.command),
    [
      "faro.showHome",
      "faro.showPath",
      "faro.showSetup",
    ],
  );
  assert.deepEqual(
    manifest.activationEvents,
    [
      "onStartupFinished",
      "onView:faro.home",
      "onView:faro.path",
      "onView:faro.setup",
      "onCommand:faro.focusSidebar",
      "onCommand:faro.showHome",
      "onCommand:faro.showPath",
      "onCommand:faro.showSetup",
      "onCommand:faro.nextBeacon",
      "onCommand:faro.previousBeacon",
      "onCommand:faro.revealCurrentBeacon",
      "onCommand:faro.setActivePath",
      "onCommand:faro.setCurrentBeacon",
    ],
  );
});
