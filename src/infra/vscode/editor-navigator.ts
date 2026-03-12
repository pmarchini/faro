import type { Beacon, BeaconRange } from "../../core/model/document.ts";
import { isValidRange } from "../../core/model/validation.ts";
import type { RevealResult } from "./reveal-result.ts";

type RevealTarget = {
  fileUri: string;
  range: BeaconRange;
};

type EditorPort = {
  revealTarget(target: RevealTarget): void | Promise<void>;
  highlightTarget?(target: RevealTarget): void | Promise<void>;
};

type EditorNavigatorDependencies = {
  fileExists(fileUri: string): boolean | Promise<boolean>;
  editor: EditorPort | null;
};

export function createEditorNavigator({
  fileExists,
  editor,
}: EditorNavigatorDependencies) {
  return {
    revealBeacon,
  };

  async function revealBeacon(beacon: Beacon): Promise<RevealResult> {
    if (!editor) {
      return { status: "unsupported-editor" };
    }

    if (!isValidRange(beacon.range)) {
      return {
        status: "invalid-target",
        beaconId: beacon.id,
      };
    }

    if (!(await fileExists(beacon.fileUri))) {
      return {
        status: "missing-file",
        fileUri: beacon.fileUri,
      };
    }

    const target = {
      fileUri: beacon.fileUri,
      range: beacon.range,
    };

    await editor.revealTarget(target);
    await editor.highlightTarget?.(target);

    return {
      status: "revealed",
      beaconId: beacon.id,
    };
  }
}
