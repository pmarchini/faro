import type { FaroDocument } from "./document.ts";

// A tour is a FaroPath grown into a graph: nodes are structured mental steps,
// edges say how they relate, and `path` is the recommended reading order.
// Paths nest: a sub path hangs off one step of another path and goes in
// depth on it. Sub paths are written lazily, when the reader dives.

export type TourTargetKind = "worktree" | "range" | "branch" | "pr" | "code" | "question";

export type TourTarget = {
  kind: TourTargetKind;
  ref: string;
  baseSha?: string;
  headSha?: string;
};

export type TourLens = "flow" | "domain";

export type TourReader = "new" | "familiar";

export type TourDepth = 0 | 1 | 2;

export type TourRange = {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
};

export type TourAnchor = {
  file: string;
  range: TourRange;
  hunk?: { oldStart: number; newStart: number };
};

export type TourBeacon = {
  label: string;
  file: string;
  line: number;
  // One sentence on why the eye should land here.
  note?: string;
};

export type TourWhySource = "commit" | "pr" | "comment" | "inferred";

export type TourWhy = {
  text: string;
  source: TourWhySource;
};

export type TourNodeRole = "path" | "supporting";

export type TourLensText = {
  summary: string;
  whatChanged?: string;
  whatItDoes?: string;
  why?: TourWhy;
};

export type TourNode = {
  id: string;
  title: string;
  plan: string;
  summary: string;
  confirms?: string;
  whatChanged?: string;
  whatItDoes?: string;
  why?: TourWhy;
  beacons: TourBeacon[];
  carryForward?: string;
  detail?: string;
  suggestedQuestion?: string;
  surprise?: string;
  anchors: TourAnchor[];
  role: TourNodeRole;
  otherLens?: TourLensText;
  // Offers a dive: the question a sub path from this step would answer.
  dive?: TourDive;
};

export type TourDive = {
  question: string;
};

// Where a sub path hangs: a step of another path and, when the reader dived
// from a line of its code, that line.
export type TourSubPathAnchor = {
  path: string;
  node: string;
  file?: string;
  line?: number;
};

export type TourSubPath = {
  id: string;
  title: string;
  // What the dive answers.
  question: string;
  anchor: TourSubPathAnchor;
  steps: string[];
};

export type TourEdgeKind = "calls" | "data" | "requires" | "tests" | "configures";

export type TourEdge = {
  from: string;
  to: string;
  kind: TourEdgeKind;
  label?: string;
};

export type TourCursor = {
  nodeId: string | null;
  depth: TourDepth;
  // The path being read; absent means the main one.
  pathId?: string;
};

export type Tour = {
  id: string;
  title: string;
  target: TourTarget;
  goal: string;
  hypothesis: string;
  lens: TourLens;
  reader: TourReader;
  nodes: Record<string, TourNode>;
  edges: TourEdge[];
  path: string[];
  // Paths written under steps, keyed by id; `path` is the main one.
  subPaths?: Record<string, TourSubPath>;
  current: TourCursor;
};

export type FaroDocumentV2 = {
  schemaVersion: 2;
  activeTourId: string | null;
  tours: Tour[];
};

export const TOUR_TARGET_KINDS: readonly TourTargetKind[] = [
  "worktree",
  "range",
  "branch",
  "pr",
  "code",
  "question",
];
export const TOUR_LENSES: readonly TourLens[] = ["flow", "domain"];
export const TOUR_READERS: readonly TourReader[] = ["new", "familiar"];
export const TOUR_WHY_SOURCES: readonly TourWhySource[] = ["commit", "pr", "comment", "inferred"];
export const TOUR_NODE_ROLES: readonly TourNodeRole[] = ["path", "supporting"];
export const TOUR_EDGE_KINDS: readonly TourEdgeKind[] = [
  "calls",
  "data",
  "requires",
  "tests",
  "configures",
];

export const MAX_BEACONS_PER_NODE = 3;
export const MAX_PATH_LENGTH = 12;
// The id that names the main path in an anchor and a cursor.
export const MAIN_PATH_ID = "main";

export function createEmptyTourDocument(): FaroDocumentV2 {
  return {
    schemaVersion: 2,
    activeTourId: null,
    tours: [],
  };
}

// v1 paths become tours with no edges: each beacon is one node on the path,
// its file URI turned into a path and its explanation kept as the L1 text.
export function migrateDocumentToV2(document: FaroDocument): FaroDocumentV2 {
  return {
    schemaVersion: 2,
    activeTourId: document.activePathId,
    tours: document.paths.map((path) => {
      const nodes: Record<string, TourNode> = {};

      for (const [id, beacon] of Object.entries(path.beacons)) {
        const file = fileUriToPath(beacon.fileUri);

        nodes[id] = {
          id,
          title: beacon.title ?? id,
          plan: "",
          summary: beacon.summary ?? beacon.title ?? id,
          whatItDoes: beacon.explanation,
          beacons: [],
          anchors: [{ file, range: { ...beacon.range } }],
          role: path.mainPath.includes(id) ? "path" : "supporting",
        };
      }

      return {
        id: path.id,
        title: path.title ?? path.id,
        target: { kind: "code", ref: path.goal ?? path.id },
        goal: path.goal ?? path.title ?? path.id,
        hypothesis: path.goal ?? path.title ?? path.id,
        lens: "flow",
        reader: "familiar",
        nodes,
        edges: [],
        path: [...path.mainPath],
        current: { nodeId: path.current?.beaconId ?? path.mainPath[0] ?? null, depth: 0 },
      };
    }),
  };
}

function fileUriToPath(fileUri: string): string {
  return decodeURIComponent(new URL(fileUri).pathname);
}

// The steps of a path by id, the main path's included; undefined when no
// such path exists.
export function pathSteps(tour: Tour, pathId: string = MAIN_PATH_ID): string[] | undefined {
  return pathId === MAIN_PATH_ID ? tour.path : tour.subPaths?.[pathId]?.steps;
}
