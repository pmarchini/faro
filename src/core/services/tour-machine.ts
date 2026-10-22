import type { FaroDocumentV2, Tour, TourDepth, TourNode } from "../model/tour.ts";
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

export function focusNode(document: FaroDocumentV2, tourId: string, nodeId: string): FaroDocumentV2 {
  const tour = requireTour(document, tourId);

  if (!tour.nodes[nodeId]) {
    throw new Error(`Tour ${tourId} has no node ${nodeId}.`);
  }

  return replaceTour(document, { ...tour, current: { nodeId, depth: tour.current.depth } });
}

export function moveOnPath(document: FaroDocumentV2, tourId: string, delta: number): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const index = tour.current.nodeId === null ? -1 : tour.path.indexOf(tour.current.nodeId);
  const nextIndex = clamp(index + delta, 0, tour.path.length - 1);
  const nodeId = tour.path[nextIndex] ?? null;

  return replaceTour(document, { ...tour, current: { ...tour.current, nodeId } });
}

export function changeDepth(document: FaroDocumentV2, tourId: string, delta: number): FaroDocumentV2 {
  const tour = requireTour(document, tourId);
  const depth = clamp(tour.current.depth + delta, 0, 2) as TourDepth;

  return replaceTour(document, { ...tour, current: { ...tour.current, depth } });
}

export function pathPosition(tour: Tour): { index: number; total: number } {
  const index = tour.current.nodeId === null ? -1 : tour.path.indexOf(tour.current.nodeId);

  return { index, total: tour.path.length };
}

function normalizeTourCursor(tour: Tour): Tour {
  const current = tour.current ?? { nodeId: null, depth: 0 };
  const nodeId =
    current.nodeId !== null && tour.path.includes(current.nodeId)
      ? current.nodeId
      : (tour.path[0] ?? null);

  return { ...tour, current: { nodeId, depth: current.depth ?? 0 } };
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
