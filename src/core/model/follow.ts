import type { Tour, TourAnchor } from "./tour.ts";
import { isValidTourRange } from "./tour-validation.ts";

// The step a reader is on in Claude Code, as the VS Code extension needs it
// to open and highlight the same code. Claude Code writes it to FOLLOW_FILE
// in the workspace on every step change; the extension watches that file.

export const FOLLOW_DIR = ".faro";
export const FOLLOW_FILE = ".faro/follow.json";

export type FollowSignal = {
  version: 1;
  root?: string;
  tourId: string;
  tourTitle: string;
  nodeId: string;
  step: number;
  total: number;
  title: string;
  summary: string;
  anchors: TourAnchor[];
  focus?: { file: string; line: number };
  updatedAt: number;
};

export function createFollowSignal(
  tour: Tour,
  { beaconIndex, root, now }: { beaconIndex: number; root?: string; now: number },
): FollowSignal | null {
  const nodeId = tour.current.nodeId;
  const node = nodeId ? tour.nodes[nodeId] : undefined;

  if (!nodeId || !node) {
    return null;
  }

  const beacon = node.beacons.length > 0 ? node.beacons[beaconIndex % node.beacons.length] : undefined;

  return {
    version: 1,
    ...(root ? { root } : {}),
    tourId: tour.id,
    tourTitle: tour.title,
    nodeId,
    step: tour.path.indexOf(nodeId) + 1,
    total: tour.path.length,
    title: node.title,
    summary: node.summary,
    anchors: node.anchors,
    ...(beacon ? { focus: { file: beacon.file, line: beacon.line } } : {}),
    updatedAt: now,
  };
}

// Reads what another process wrote: anything malformed is ignored rather
// than thrown, since the file may be caught mid-write.
export function parseFollowSignal(text: string): FollowSignal | null {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const signal = value as FollowSignal;
  const hasAnchors =
    Array.isArray(signal.anchors) &&
    signal.anchors.length > 0 &&
    signal.anchors.every((anchor) => typeof anchor?.file === "string" && isValidTourRange(anchor.range));
  const hasFocus =
    signal.focus === undefined ||
    (typeof signal.focus?.file === "string" && Number.isInteger(signal.focus.line) && signal.focus.line >= 1);

  if (
    signal.version !== 1 ||
    typeof signal.tourId !== "string" ||
    typeof signal.nodeId !== "string" ||
    typeof signal.title !== "string" ||
    typeof signal.updatedAt !== "number" ||
    !hasAnchors ||
    !hasFocus
  ) {
    return null;
  }

  return signal;
}
