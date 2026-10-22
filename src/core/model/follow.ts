import type { Tour, TourAnchor, TourBeacon, TourLens, TourNode, TourTarget, TourWhy } from "./tour.ts";
import { isValidTourRange } from "./tour-validation.ts";

// The bridge between the Claude Code pane and the VS Code extension, three
// files in the workspace's .faro folder:
// - follow.json: Claude Code writes the reader's step on every change; the
//   extension opens and highlights the same code.
// - ack.json: the extension's heartbeat while it follows; the pane reads it
//   to know it is paired and can fold its own code panel.
// - control.json: next, back or a step chosen in VS Code; Claude Code reads
//   it and moves, so the tour's state has one owner.

export const FOLLOW_DIR = ".faro";
export const FOLLOW_FILE = ".faro/follow.json";
export const FOLLOW_ACK_FILE = ".faro/ack.json";
export const FOLLOW_CONTROL_FILE = ".faro/control.json";

// What the reader sees about the step in the pane, for VS Code to show as a
// note over the code. It is written in the lens the pane is showing.
export type FollowNote = {
  plan: string;
  lens: TourLens;
  surprise?: string;
  confirms?: string;
  whatChanged?: string;
  whatItDoes?: string;
  why?: TourWhy;
  beacon?: { label: string; line: number };
  carryForward?: string;
  detail?: string;
};

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
  beaconIndex?: number;
  beacons?: TourBeacon[];
  steps?: Array<{ nodeId: string; title: string }>;
  // The ref a diff tour is read against; absent for a tour of existing code.
  diffBase?: string;
  note?: FollowNote;
  updatedAt: number;
};

export type FollowAction = "next" | "previous" | "step" | "beacon";

export type FollowControl = {
  version: 1;
  id: string;
  tourId: string;
  action: FollowAction;
  nodeId?: string;
};

export function createFollowSignal(
  tour: Tour,
  {
    beaconIndex,
    root,
    now,
    isOtherLensShown = false,
  }: { beaconIndex: number; root?: string; now: number; isOtherLensShown?: boolean },
): FollowSignal | null {
  const nodeId = tour.current.nodeId;
  const node = nodeId ? tour.nodes[nodeId] : undefined;

  if (!nodeId || !node) {
    return null;
  }

  const index = node.beacons.length > 0 ? beaconIndex % node.beacons.length : 0;
  const beacon = node.beacons[index];
  const diffBase = diffBaseOf(tour.target);
  const lensText = isOtherLensShown && node.otherLens ? node.otherLens : node;

  return {
    version: 1,
    ...(root ? { root } : {}),
    tourId: tour.id,
    tourTitle: tour.title,
    nodeId,
    step: tour.path.indexOf(nodeId) + 1,
    total: tour.path.length,
    title: node.title,
    summary: lensText.summary,
    anchors: node.anchors,
    ...(beacon ? { focus: { file: beacon.file, line: beacon.line }, beaconIndex: index } : {}),
    beacons: node.beacons,
    steps: tour.path.flatMap((id) => (tour.nodes[id] ? [{ nodeId: id, title: tour.nodes[id].title }] : [])),
    ...(diffBase ? { diffBase } : {}),
    note: createFollowNote(tour, node, lensText, beacon),
    updatedAt: now,
  };
}

function createFollowNote(
  tour: Tour,
  node: TourNode,
  lensText: Pick<TourNode, "whatChanged" | "whatItDoes" | "why">,
  beacon: TourNode["beacons"][number] | undefined,
): FollowNote {
  const isOtherLens = lensText !== node;
  const note: FollowNote = {
    plan: node.plan,
    lens: isOtherLens ? (tour.lens === "flow" ? "domain" : "flow") : tour.lens,
    surprise: node.surprise,
    confirms: node.confirms,
    whatChanged: lensText.whatChanged,
    whatItDoes: lensText.whatItDoes,
    why: lensText.why,
    beacon: beacon ? { label: beacon.label, line: beacon.line } : undefined,
    carryForward: node.carryForward,
    detail: node.detail,
  };

  return Object.fromEntries(Object.entries(note).filter(([, value]) => value !== undefined)) as FollowNote;
}

// The ref VS Code compares the working file against, for tours of a change.
export function diffBaseOf(target: TourTarget): string | undefined {
  switch (target.kind) {
    case "worktree":
      return target.baseSha ?? "HEAD";
    case "range":
      return target.baseSha ?? (target.ref.split(/\.{2,3}/)[0] || undefined);
    case "branch":
    case "pr":
      return target.baseSha;
    default:
      return undefined;
  }
}

export function parseFollowControl(text: string): FollowControl | null {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  const control = value as FollowControl | null;
  const actions: FollowAction[] = ["next", "previous", "step", "beacon"];

  if (
    !control ||
    control.version !== 1 ||
    typeof control.id !== "string" ||
    typeof control.tourId !== "string" ||
    !actions.includes(control.action) ||
    (control.action === "step" && typeof control.nodeId !== "string")
  ) {
    return null;
  }

  return control;
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
