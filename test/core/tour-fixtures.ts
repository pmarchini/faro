import type { FaroDocumentV2, Tour, TourNode } from "../../src/core/model/tour.ts";

export function createNode(id: string, overrides: Partial<TourNode> = {}): TourNode {
  return {
    id,
    title: `Step ${id}`,
    plan: "guard clause",
    summary: `What happens in ${id}`,
    carryForward: `Hold ${id} in mind`,
    beacons: [{ label: `${id}()`, file: `src/${id}.ts`, line: 3 }],
    anchors: [{ file: `src/${id}.ts`, range: { startLine: 1, endLine: 10 } }],
    role: "path",
    ...overrides,
  };
}

export function createTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: "session-persistence",
    title: "Session persistence",
    target: { kind: "worktree", ref: "HEAD" },
    goal: "Why do sessions survive a restart?",
    hypothesis: "Tokens are persisted before the login reply is sent.",
    lens: "flow",
    reader: "familiar",
    nodes: { n1: createNode("n1"), n2: createNode("n2"), n3: createNode("n3") },
    edges: [
      { from: "n1", to: "n2", kind: "calls" },
      { from: "n2", to: "n3", kind: "data", label: "the token flows on" },
    ],
    path: ["n1", "n2", "n3"],
    current: { nodeId: "n1", depth: 0 },
    ...overrides,
  };
}

export function createTourDocument(overrides: Partial<FaroDocumentV2> = {}): FaroDocumentV2 {
  return {
    schemaVersion: 2,
    activeTourId: "session-persistence",
    tours: [createTour()],
    ...overrides,
  };
}
