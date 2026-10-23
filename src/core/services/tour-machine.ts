import {
  MAIN_PATH_ID,
  pathSteps,
  type FaroDocumentV2,
  type Tour,
  type TourDepth,
  type TourNode,
  type TourSubPath,
} from "../model/tour.ts";
import { assertValidTour, findNodeProblems } from "../model/tour-validation.ts";

// Pure operations on a v2 document. Each returns a new document and leaves
// its input untouched, so a host can keep the old value until a write lands.

export function upsertTour(document: FaroDocumentV2, tour: Tour): FaroDocumentV2 {
  const nextTour = normalizeTourCursor(clone(tour));
  assertValidTour(nextTour);

  const tours = document.tours.filter((entry) => entry.id !== nextTour.id);
  const index = document.tours.findIndex((entry) => entry.id === nextTour.id);
  tours.splice(index === -1 ? tours.length : index, 0, nextTour);

  return { ...document, tours, activeTourId: nextTour.id };
}

export function removeTour(document: FaroDocumentV2, tourId: string): FaroDocumentV2 {
  const tours = document.tours.filter((entry) => entry.id !== tourId);
  const activeTourId =
    document.activeTourId === tourId ? (tours[tours.length - 1]?.id ?? null) : document.activeTourId;

  return { ...document, tours, activeTourId };
}

export function getTour(document: FaroDocumentV2, tourId?: string): Tour | undefined {
  const id = tourId ?? document.activeTourId;

  return document.tours.find((entry) => entry.id === id);
}

export type NodeUpdate = {
  node: TourNode;
  // Puts a new node on the path after this id; a node that exists keeps its place.
  insertAfter?: string;
};

export function updateNode(
  document: FaroDocumentV2,
  tourId: string,
  { node, insertAfter }: NodeUpdate,
): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const isKnown = Boolean(tour.nodes[node.id]);

  if (!isKnown && insertAfter === undefined) {
    throw new Error(`Tour ${tourId} has no node ${node.id}; pass insertAfter to add it.`);
  }

  if (insertAfter !== undefined && !isKnown && !tour.path.includes(insertAfter)) {
    throw new Error(`Tour ${tourId} path has no node ${insertAfter} to insert after.`);
  }

  const problems = findNodeProblems(`Tour ${tourId}`, node.id, node);

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }

  const nextTour = clone(tour);
  nextTour.nodes[node.id] = clone(node);

  if (!isKnown && insertAfter !== undefined && node.role === "path") {
    nextTour.path.splice(nextTour.path.indexOf(insertAfter) + 1, 0, node.id);
  }

  return replaceTour(document, nextTour);
}

export type SubPathWrite = {
  subPath: TourSubPath;
  // The sub path's new or rewritten nodes; a step may also name a node the
  // tour already has.
  nodes: TourNode[];
};

// Adds a sub path under a step, or rewrites one with the same id, keeping
// the reader where they are.
export function addSubPath(document: FaroDocumentV2, tourId: string, { subPath, nodes }: SubPathWrite): FaroDocumentV2 {
  const nextTour = clone(requireTour(document, tourId));

  for (const node of nodes) {
    nextTour.nodes[node.id] = clone(node);
  }

  nextTour.subPaths = { ...nextTour.subPaths, [subPath.id]: clone(subPath) };
  assertValidTour(nextTour);

  return replaceTour(document, nextTour);
}

// The sub paths hanging from a step of a path, in the order they were written.
export function subPathsAt(tour: Tour, pathId: string, nodeId: string): TourSubPath[] {
  return Object.values(tour.subPaths ?? {}).filter(
    (subPath) => subPath.anchor.path === pathId && subPath.anchor.node === nodeId,
  );
}

export function currentPathId(tour: Tour): string {
  return tour.current.pathId ?? MAIN_PATH_ID;
}

// The paths from the main one down to this one, each with the step the
// reader dived from (none for the path itself).
export function pathTrail(tour: Tour, pathId: string = currentPathId(tour)): { pathId: string; nodeId?: string }[] {
  const trail: { pathId: string; nodeId?: string }[] = [{ pathId }];
  let at = tour.subPaths?.[pathId];

  while (at && trail.length <= Object.keys(tour.subPaths ?? {}).length) {
    trail.unshift({ pathId: at.anchor.path, nodeId: at.anchor.node });
    at = tour.subPaths?.[at.anchor.path];
  }

  return trail;
}

export function focusNode(
  document: FaroDocumentV2,
  tourId: string,
  nodeId: string,
  pathId?: string,
): FaroDocumentV2 {
  const tour = requireTour(document, tourId);

  if (!tour.nodes[nodeId]) {
    throw new Error(`Tour ${tourId} has no node ${nodeId}.`);
  }

  const onPath = pathId ?? pathHolding(tour, nodeId);

  if (onPath !== undefined && !pathSteps(tour, onPath)?.includes(nodeId)) {
    throw new Error(`Path ${onPath} of tour ${tourId} has no step ${nodeId}.`);
  }

  return replaceTour(document, { ...tour, current: cursor(nodeId, tour.current.depth, onPath) });
}

// Starts reading a sub path at its first step.
export function enterPath(document: FaroDocumentV2, tourId: string, pathId: string): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const steps = pathSteps(tour, pathId);

  if (!steps || steps.length === 0) {
    throw new Error(`Tour ${tourId} has no path ${pathId}.`);
  }

  return replaceTour(document, { ...tour, current: cursor(steps[0] ?? null, tour.current.depth, pathId) });
}

// Back up one level, to the step the current sub path hangs from.
export function surface(document: FaroDocumentV2, tourId: string): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const subPath = tour.subPaths?.[currentPathId(tour)];

  if (!subPath) {
    return document;
  }

  return replaceTour(document, {
    ...tour,
    current: cursor(subPath.anchor.node, tour.current.depth, subPath.anchor.path),
  });
}

// j and k move along the path being read. Off either end of a sub path the
// reader surfaces to the step it hangs from; the main path stops at its ends.
export function moveOnPath(document: FaroDocumentV2, tourId: string, delta: number): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const steps = pathSteps(tour, currentPathId(tour)) ?? tour.path;
  const index = tour.current.nodeId === null ? -1 : steps.indexOf(tour.current.nodeId);
  const isOffEnd = index + delta < 0 || index + delta > steps.length - 1;

  if (isOffEnd && currentPathId(tour) !== MAIN_PATH_ID) {
    return surface(document, tourId);
  }

  const nodeId = steps[clamp(index + delta, 0, steps.length - 1)] ?? null;

  return replaceTour(document, { ...tour, current: { ...tour.current, nodeId } });
}

export function changeDepth(document: FaroDocumentV2, tourId: string, delta: number): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const depth = clamp(tour.current.depth + delta, 0, 2) as TourDepth;

  return replaceTour(document, { ...tour, current: { ...tour.current, depth } });
}

export function pathPosition(tour: Tour): { index: number; total: number } {
  const steps = pathSteps(tour, currentPathId(tour)) ?? tour.path;
  const index = tour.current.nodeId === null ? -1 : steps.indexOf(tour.current.nodeId);

  return { index, total: steps.length };
}

// The path a node is a step of: the main path first, then sub paths.
function pathHolding(tour: Tour, nodeId: string): string | undefined {
  if (tour.path.includes(nodeId)) {
    return undefined;
  }

  return Object.values(tour.subPaths ?? {}).find((subPath) => subPath.steps.includes(nodeId))?.id;
}

function cursor(nodeId: string | null, depth: TourDepth, pathId: string | undefined): Tour["current"] {
  return pathId === undefined || pathId === MAIN_PATH_ID ? { nodeId, depth } : { nodeId, depth, pathId };
}

function normalizeTourCursor(tour: Tour): Tour {
  const current = tour.current ?? { nodeId: null, depth: 0 };
  const pathId = current.pathId !== undefined && pathSteps(tour, current.pathId) ? current.pathId : undefined;
  const steps = pathSteps(tour, pathId) ?? tour.path;
  const nodeId =
    current.nodeId !== null && steps.includes(current.nodeId) ? current.nodeId : (steps[0] ?? null);

  return { ...tour, current: cursor(nodeId, current.depth ?? 0, pathId) };
}

function replaceTour(document: FaroDocumentV2, tour: Tour): FaroDocumentV2 {
  return {
    ...document,
    tours: document.tours.map((entry) => (entry.id === tour.id ? tour : entry)),
  };
}

function requireTour(document: FaroDocumentV2, tourId: string): Tour {
  const tour = getTour(document, tourId);

  if (!tour) {
    throw new Error(`No tour ${tourId}.`);
  }

  return tour;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// JSON round-trip rather than structuredClone: the Claude Code mod host runs
// this module in an environment without Node globals.
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
