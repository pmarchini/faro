import {
  MAX_BEACONS_PER_NODE,
  MAX_PATH_LENGTH,
  TOUR_EDGE_KINDS,
  TOUR_LENSES,
  TOUR_NODE_ROLES,
  TOUR_READERS,
  TOUR_TARGET_KINDS,
  TOUR_WHY_SOURCES,
  type FaroDocumentV2,
  type Tour,
  type TourAnchor,
  type TourNode,
  type TourRange,
  type TourWhy,
} from "./tour.ts";

// Problems are collected rather than thrown one at a time, so an agent that
// wrote a bad tour can fix every problem in one retry.

export function assertValidTourDocument(document: FaroDocumentV2): void {
  if (!document || typeof document !== "object") {
    throw new Error("Document must be an object.");
  }

  if (document.schemaVersion !== 2) {
    throw new Error("schemaVersion must be 2.");
  }

  if (!Array.isArray(document.tours)) {
    throw new Error("tours must be an array.");
  }

  const tourIds = new Set<string>();

  for (const tour of document.tours) {
    assertValidTour(tour);

    if (tourIds.has(tour.id)) {
      throw new Error(`Duplicate tour id: ${tour.id}`);
    }

    tourIds.add(tour.id);
  }

  if (document.activeTourId !== null && !tourIds.has(document.activeTourId)) {
    throw new Error("activeTourId must refer to an existing tour.");
  }
}

export function assertValidTour(tour: Tour): void {
  const problems = findTourProblems(tour);

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
}

export function findTourProblems(tour: Tour): string[] {
  if (!tour || typeof tour !== "object") {
    return ["Tour must be an object."];
  }

  const problems: string[] = [];
  const where = `Tour ${tour.id || "(no id)"}`;

  if (!isNonEmptyString(tour.id)) {
    problems.push("Tour id is required.");
  }

  for (const field of ["title", "goal", "hypothesis"] as const) {
    if (!isNonEmptyString(tour[field])) {
      problems.push(`${where} ${field} is required.`);
    }
  }

  if (!tour.target || !TOUR_TARGET_KINDS.includes(tour.target.kind)) {
    problems.push(`${where} target.kind must be one of ${TOUR_TARGET_KINDS.join(", ")}.`);
  } else if (!isNonEmptyString(tour.target.ref)) {
    problems.push(`${where} target.ref is required.`);
  }

  if (!TOUR_LENSES.includes(tour.lens)) {
    problems.push(`${where} lens must be one of ${TOUR_LENSES.join(", ")}.`);
  }

  if (!TOUR_READERS.includes(tour.reader)) {
    problems.push(`${where} reader must be one of ${TOUR_READERS.join(", ")}.`);
  }

  if (!tour.nodes || typeof tour.nodes !== "object" || Array.isArray(tour.nodes)) {
    problems.push(`${where} nodes must be an object keyed by node id.`);
    return problems;
  }

  for (const [key, node] of Object.entries(tour.nodes)) {
    problems.push(...findNodeProblems(where, key, node));
  }

  problems.push(...findPathProblems(where, tour));
  problems.push(...findEdgeProblems(where, tour));

  return problems;
}

export function findNodeProblems(where: string, key: string, node: TourNode): string[] {
  if (!node || typeof node !== "object") {
    return [`${where} node ${key} must be an object.`];
  }

  const problems: string[] = [];
  const at = `${where} node ${key}`;

  if (node.id !== key) {
    problems.push(`${at} id must match its key.`);
  }

  for (const field of ["title", "summary"] as const) {
    if (!isNonEmptyString(node[field])) {
      problems.push(`${at} ${field} is required.`);
    }
  }

  if (typeof node.plan !== "string") {
    problems.push(`${at} plan must be a string.`);
  }

  if (!TOUR_NODE_ROLES.includes(node.role)) {
    problems.push(`${at} role must be one of ${TOUR_NODE_ROLES.join(", ")}.`);
  }

  if (node.why !== undefined && !isValidWhy(node.why)) {
    problems.push(`${at} why needs text and a source of ${TOUR_WHY_SOURCES.join(", ")}.`);
  }

  if (node.otherLens?.why !== undefined && !isValidWhy(node.otherLens.why)) {
    problems.push(`${at} otherLens.why needs text and a source of ${TOUR_WHY_SOURCES.join(", ")}.`);
  }

  if (!Array.isArray(node.anchors) || node.anchors.length === 0) {
    problems.push(`${at} needs at least one anchor.`);
  } else {
    node.anchors.forEach((anchor, index) => {
      if (!isNonEmptyString(anchor?.file)) {
        problems.push(`${at} anchor ${index} file is required.`);
      }

      if (!isValidTourRange(anchor?.range)) {
        problems.push(`${at} anchor ${index} range must be 1-based with endLine >= startLine.`);
      }
    });
  }

  if (!Array.isArray(node.beacons)) {
    problems.push(`${at} beacons must be an array.`);
    return problems;
  }

  if (node.beacons.length > MAX_BEACONS_PER_NODE) {
    problems.push(`${at} has ${node.beacons.length} beacons; keep at most ${MAX_BEACONS_PER_NODE}.`);
  }

  for (const beacon of node.beacons) {
    if (!isNonEmptyString(beacon?.label) || !isNonEmptyString(beacon?.file)) {
      problems.push(`${at} beacon needs a label and a file.`);
      continue;
    }

    if (!Number.isInteger(beacon.line) || beacon.line < 1) {
      problems.push(`${at} beacon ${beacon.label} line must be a 1-based integer.`);
      continue;
    }

    if (Array.isArray(node.anchors) && !isLineInAnchors(beacon.file, beacon.line, node.anchors)) {
      problems.push(
        `${at} beacon ${beacon.label} (${beacon.file}:${beacon.line}) is outside every anchor range of that file.`,
      );
    }
  }

  return problems;
}

function findPathProblems(where: string, tour: Tour): string[] {
  if (!Array.isArray(tour.path)) {
    return [`${where} path must be an array of node ids.`];
  }

  const problems: string[] = [];

  if (tour.path.length === 0) {
    problems.push(`${where} path must name at least one node.`);
  }

  if (tour.path.length > MAX_PATH_LENGTH) {
    problems.push(`${where} path has ${tour.path.length} nodes; keep at most ${MAX_PATH_LENGTH}.`);
  }

  const seen = new Set<string>();

  for (const nodeId of tour.path) {
    if (!tour.nodes[nodeId]) {
      problems.push(`${where} path names missing node ${nodeId}.`);
    }

    if (seen.has(nodeId)) {
      problems.push(`${where} path visits ${nodeId} twice.`);
    }

    seen.add(nodeId);
  }

  const current = tour.current;

  if (!current || typeof current !== "object") {
    problems.push(`${where} current is required.`);
  } else {
    if (current.nodeId !== null && !tour.path.includes(current.nodeId)) {
      problems.push(`${where} current.nodeId must be null or on the path.`);
    }

    if (current.depth !== 0 && current.depth !== 1 && current.depth !== 2) {
      problems.push(`${where} current.depth must be 0, 1 or 2.`);
    }
  }

  return problems;
}

function findEdgeProblems(where: string, tour: Tour): string[] {
  if (!Array.isArray(tour.edges)) {
    return [`${where} edges must be an array.`];
  }

  const problems: string[] = [];

  for (const edge of tour.edges) {
    const name = `${edge?.from} -> ${edge?.to}`;

    if (!tour.nodes[edge?.from]) {
      problems.push(`${where} edge ${name} starts at a missing node.`);
    }

    if (!tour.nodes[edge?.to]) {
      problems.push(`${where} edge ${name} ends at a missing node.`);
    }

    if (edge?.from === edge?.to) {
      problems.push(`${where} edge ${name} loops on itself.`);
    }

    if (!TOUR_EDGE_KINDS.includes(edge?.kind)) {
      problems.push(`${where} edge ${name} kind must be one of ${TOUR_EDGE_KINDS.join(", ")}.`);
    }
  }

  return problems;
}

// Soft rules from the explanation model: they never refuse a tour, they are
// returned to the author as advice.
export function lintTour(tour: Tour): string[] {
  const advice: string[] = [];
  const pathNodes = tour.path
    .map((id) => tour.nodes[id])
    .filter((node): node is TourNode => node !== undefined);

  if (pathNodes.length > 9) {
    advice.push(`The path has ${pathNodes.length} nodes; 5 to 7 is the budget, 8 or 9 only when needed.`);
  }

  pathNodes.forEach((node, index) => {
    if (index < pathNodes.length - 1 && !isNonEmptyString(node.carryForward)) {
      advice.push(`Node ${node.id} has no carryForward, so the step to the next node is not checkable.`);
    }

    if (node.role !== "path") {
      advice.push(`Node ${node.id} is on the path but has role "${node.role}".`);
    }

    if (node.title.split(/\s+/).length > 6) {
      advice.push(`Node ${node.id} title is over 6 words.`);
    }

    if (node.beacons.length === 0) {
      advice.push(`Node ${node.id} has no beacons for the reader's eye to land on.`);
    }

    const lines = node.anchors.reduce(
      (total, anchor) => total + anchor.range.endLine - anchor.range.startLine + 1,
      0,
    );

    if (lines > 40) {
      advice.push(`Node ${node.id} anchors ${lines} lines; split it or narrow the ranges to under 40.`);
    }
  });

  return advice;
}

export function isValidTourRange(range: unknown): range is TourRange {
  if (!range || typeof range !== "object") {
    return false;
  }

  const { startLine, endLine } = range as TourRange;

  return (
    Number.isInteger(startLine) &&
    Number.isInteger(endLine) &&
    startLine >= 1 &&
    endLine >= startLine
  );
}

function isLineInAnchors(file: string, line: number, anchors: TourAnchor[]): boolean {
  return anchors.some(
    (anchor) =>
      anchor?.file === file &&
      isValidTourRange(anchor.range) &&
      line >= anchor.range.startLine &&
      line <= anchor.range.endLine,
  );
}

function isValidWhy(why: TourWhy): boolean {
  return isNonEmptyString(why?.text) && TOUR_WHY_SOURCES.includes(why?.source);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
