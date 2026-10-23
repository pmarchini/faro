# Tour schema (Faro document schemaVersion 2)

The source of truth is `src/core/model/tour.ts`, with the rules in `src/core/model/tour-validation.ts`. Re-read them if this page and the code disagree; the code wins.

A tour is a Faro path grown into a graph. `mainPath` became `path`, beacons became structured `nodes`, and `edges` fill the slot v1 reserved as `branches`. A v1 document migrates by wrapping each path as a tour with no edges (`migrateDocumentToV2`).

## Shape

```ts
type FaroDocumentV2 = {
  schemaVersion: 2;
  activeTourId: string | null;
  tours: Tour[];
};

type Tour = {
  id: string;                       // stable slug: "session-persistence"
  title: string;
  target: {
    kind: "worktree" | "range" | "branch" | "pr" | "code" | "question";
    ref: string;                    // "HEAD", "main..feature", "#482", "src/auth/", "how does X work?"
    baseSha?: string;
    headSha?: string;
  };
  goal: string;                     // the question the tour answers
  hypothesis: string;               // the one-sentence claim the nodes confirm
  lens: "flow" | "domain";          // the lens written up front
  reader: "new" | "familiar";
  nodes: Record<string, TourNode>;  // keyed by node id
  edges: TourEdge[];
  path: string[];                   // recommended reading order, node ids
  current: { nodeId: string | null; depth: 0 | 1 | 2 };
};

type TourNode = {
  id: string;                       // must equal its key in nodes
  title: string;                    // L0, the concept, 6 words at most
  plan: string;                     // L0, "retry with backoff"
  summary: string;                  // L0, one sentence
  confirms?: string;                // L1, which part of the hypothesis
  whatChanged?: string;             // L1, diff tours: behaviour before vs after
  whatItDoes?: string;              // L1, code and question tours
  why?: { text: string; source: "commit" | "pr" | "comment" | "inferred" };
  beacons: { label: string; file: string; line: number; note?: string }[];   // 0 to 3; note: one sentence on why the eye lands here
  carryForward?: string;            // L1, the one thing to hold for the next node
  detail?: string;                  // L2, edge cases, failure handling
  suggestedQuestion?: string;       // L2, the likely next question
  surprise?: string;                // a plan violation worth flagging
  anchors: {
    file: string;                   // path relative to the repository root
    range: { startLine: number; endLine: number; startColumn?: number; endColumn?: number };
    hunk?: { oldStart: number; newStart: number };
  }[];
  role: "path" | "supporting";      // supporting nodes stay off the path
  otherLens?: {                     // written on the reader's first `l` press
    summary: string;
    whatChanged?: string;
    whatItDoes?: string;
    why?: { text: string; source: "commit" | "pr" | "comment" | "inferred" };
  };
};

type TourEdge = {
  from: string;
  to: string;
  kind: "calls" | "data" | "requires" | "tests" | "configures";
  label?: string;                   // why the reader goes from -> to
};
```

## Refused by the tools

`tour_upsert` and `tour_update_node` refuse a tour or node, listing every problem at once, when:

- `id`, `title`, `goal` or `hypothesis` is empty, or `target.kind`, `lens`, `reader`, a node's `role`, an edge's `kind` or a `why.source` is not one of its values
- a node's `id` differs from its key, or it has no `title`, no `summary` or no anchor
- an anchor range is not 1-based with `endLine >= startLine`
- a node has more than 3 beacons, or a beacon's `file:line` is outside every anchor of that file
- `path` is empty, over 12 nodes, names a missing node, or visits a node twice
- an edge starts or ends at a missing node, or loops on itself
- `current.nodeId` is neither `null` nor on the path, or `current.depth` is not 0, 1 or 2

## Returned as advice

`tour_upsert` accepts these but lists them, so you can fix them in a follow-up `tour_update_node`:

- the path has more than 9 nodes
- a path node other than the last has no `carryForward`
- a path node has `role: "supporting"`, a title over 6 words, or no beacons
- a beacon has no `note`
- a node's anchors cover more than 40 lines

## Paths in anchors and beacons

Use paths relative to the repository root (`src/auth/session.ts`), the same spelling in a node's anchors and its beacons. v1 beacons used `file://` URIs; tours do not.

For a diff tour, anchor ranges and beacon lines refer to the new side of the diff (the file as it is now). Set `hunk` when the anchor follows one hunk, so the pane can show that hunk's before and after.

## A small example

```json
{
  "id": "faro-tour-tools",
  "title": "How the tour tools reach the pane",
  "target": { "kind": "question", "ref": "how does the Claude Code plugin work?" },
  "goal": "How does a tour written by Claude end up in the pane?",
  "hypothesis": "Claude writes a whole tour through one tool, core validation refuses bad data, and the pane only reads the stored document.",
  "lens": "flow",
  "reader": "familiar",
  "nodes": {
    "upsert": {
      "id": "upsert",
      "title": "One tool call writes the tour",
      "plan": "whole-document write",
      "summary": "tour_upsert takes the full tour and stores it as the active one.",
      "confirms": "The 'one tool' half of the hypothesis.",
      "whatItDoes": "The tool handler validates the tour, writes the document to session state and opens the pane.",
      "why": { "text": "Whole-path writes proved simpler than many small edits in the VS Code extension.", "source": "comment" },
      "beacons": [{ "label": "upsertTour", "file": "claude-code/tools.ts", "line": 81 }],
      "carryForward": "Nothing reaches the pane without passing validation.",
      "anchors": [{ "file": "claude-code/tools.ts", "range": { "startLine": 74, "endLine": 111 } }],
      "role": "path"
    }
  },
  "edges": [],
  "path": ["upsert"],
  "current": { "nodeId": "upsert", "depth": 0 }
}
```
