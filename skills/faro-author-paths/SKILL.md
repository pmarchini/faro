---
name: faro-author-paths
description: Author Faro reading paths and tours that explain code following program-comprehension research. Use when asked to explain a change, a diff, a commit range, a branch or PR, or how existing code or a flow works ("walk me through what you changed", "explain this PR", "how does X work in this repo", "give me a tour of the diff", /explain), or to create or revise a Faro path for the VS Code extension. Not for a one-line "what does this function do", which a short chat answer serves better.
---

# Faro Author Paths

Faro turns an explanation of code into a short, navigable reading spine grounded in real code ranges. It has two front ends that share this skill:

- **Tours** (Faro document `schemaVersion: 2`): drawn by the Claude Code plugin in a pane beside the chat, written through the `mcp__faro__tour_*` tools. Use them whenever those tools are available.
- **Paths** (Faro document `schemaVersion: 1`): drawn by the VS Code extension, written through the `faro.*` MCP tools.

Both follow the same explanation model. Read `comprehension.md` (beside this file) before authoring a tour: it holds the rules and the research behind them.

## Tours: the Claude Code plugin

### Reference files

- `comprehension.md`: the explanation model. Read it first, every time.
- `tour-schema.md`: the Tour type, what the tools refuse and what they return as advice. The source of truth is `src/core/model/tour.ts`.

### Tools

- `tour_upsert { tour }`: create or replace a whole tour; it becomes active and the pane opens on its first path node. Prefer one whole-tour write.
- `tour_update_node { tourId, node, insertAfter? }`: replace one node (or add one after `insertAfter`) and keep the reader's place. Use it to refine a node after a question, to re-explain a node the reader marked as unclear, and to fill `otherLens` when the reader asks for the other lens.
- `tour_get { tourId? }`: the tour plus the reader's state (current node and depth, visited nodes, nodes marked "don't get this"). Read it before answering a question about the tour.
- `tour_focus { tourId, nodeId }`: move the reader to a node ("look at step 4").
- `tour_list`: live and pinned tours.

### Workflow

1. Resolve the target. `/explain` hands you its kind, ref, goal, depth, lens and reader. Without the command, infer them: uncommitted changes (`git diff HEAD`), a range (`git diff A..B`, `git log A..B` for intent), a branch against its merge base, a PR (`gh pr diff`, `gh pr view` for stated intent), a path, or a question about existing code.
2. Read the change or code. For a question, find the entry point and trace the flow; the question itself is the goal.
3. Write the goal and a one-sentence hypothesis. If none fits, narrow the target.
4. Choose the mental steps: one node per step, 5 to 7 on the path (about 4 for `brief`, up to 9 for `deep`), in causal order for the `flow` lens or concept order for `domain`. Supporting changes become `role: "supporting"` nodes off the path.
5. Fill each node at L0 and L1 in the chosen lens only; add L2 (`detail`, `suggestedQuestion`) for `standard` and `deep`. Mark `why.source` honestly: `inferred` unless a commit, PR or comment states it.
6. Add edges between related nodes, path and supporting alike.
7. Check that adjacent path nodes share a carry-forward, then call `tour_upsert` once. If it refuses, fix every listed problem and call it again. Weigh the advice it returns.
8. Reply in chat in two or three lines: the goal, the shape of the change or flow, and that the pane is open to walk it. Do not repeat the tour in chat.

### Follow-ups from the pane

The pane sends prompts that name the tour and node. Answer them in chat, and change the tour through `tour_update_node` when the answer belongs in it:

- a question about a node: answer it; if the node was missing something, update it.
- "I don't get this": call `tour_get` to see where the reader is, then rewrite only that node more simply (shorter sentences, a concrete example in `detail`, fewer terms).
- the other lens: write `otherLens` for that node (summary, whatChanged or whatItDoes, why) in the lens the tour was not written in, and keep everything else unchanged.
- a stale node (its files changed since the tour was written): re-read the anchors and update the node's ranges, beacons and text.

### When the pane is unavailable

Under `claude -p` or with the plugin not installed there are no `tour_*` tools. Then explain in chat in the same shape: the goal and hypothesis, then the path as a numbered list, one line per node (title, plan, file:line), and the L1 text for each node below it.

## Paths: the VS Code extension

The canonical v1 schema lives in `src/core/model/document.ts`. Do not invent a parallel schema; re-read that file if the shape is uncertain.

### Current product limits

- linear `mainPath` only
- one active path at a time
- one active beacon at a time
- `schemaVersion` is `1`
- `activePathId` must be `null` or match an existing path id

Current contract operations are `faro.listPaths`, `faro.getPath`, `faro.upsertPath`, `faro.setActivePath`, `faro.setCurrentBeacon` and `faro.deletePath`.

Faro exposes a local stdio MCP server in VS Code for these operations. Only claim this when the current agent runtime actually exposes the `faro.*` tools. If the runtime does not expose them, produce valid Faro path data or a precise edit plan that fits the canonical model.

### Required path rules

For each `FaroPath`:

- `id` must be stable and unique within the document
- every id in `mainPath` must exist in `beacons`
- `current.beaconId` must be `null` or one of the ids in `mainPath`
- `current.index` must match the position of `current.beaconId`
- `beacons` is a dictionary keyed by beacon id

For each `Beacon`:

- `id` must match the dictionary key
- `fileUri` must use the `file://` scheme
- `range` is 1-based
- `range.endLine` must not be before `range.startLine`
- if start and end line are the same, `endColumn` must not be before `startColumn`

### Workflow

1. Identify the user goal or subsystem to explain.
2. Start with `faro.listPaths` when tools are available so you do not overwrite state blindly.
3. Use `faro.getPath` before revising an existing path.
4. Decide whether to create a new path or replace/update an existing one.
5. Prefer one `faro.upsertPath` whole-path write rather than many tiny state changes.
6. Keep the path narrow and linear unless the user explicitly asks for more.
7. Use `faro.setActivePath` only when the authored path should become the main reading path immediately.
8. Use `faro.setCurrentBeacon` only when the starting point should move after authoring.
9. Make titles and explanations concrete enough to be navigable.
10. Validate `mainPath`, `beacons`, and `current` consistency before returning.

### Output preference

Prefer returning one of these:

- a full `FaroDocument` when the user wants the whole state
- a single `FaroPath` when the user wants one path created or replaced
- a precise edit plan when the runtime surface is not yet available

### Minimal shape

```ts
type FaroDocument = {
  schemaVersion: 1;
  activePathId: string | null;
  paths: FaroPath[];
};

type FaroPath = {
  id: string;
  title?: string;
  goal?: string;
  mainPath: string[];
  branches?: unknown[];
  current?: {
    mode: "main";
    index: number;
    beaconId: string | null;
  };
  beacons: Record<string, {
    id: string;
    title?: string;
    fileUri: string;
    range: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    summary?: string;
    explanation?: string;
    tags?: string[];
    children?: string[];
  }>;
};
```

## Good defaults

- use short stable ids such as `auth-flow` or `cache-invalidation`
- keep titles readable and the goal explicit
- make summaries concise and explanations slightly more detailed
- use tags only when they help navigation

## Avoid

- branch-heavy structures in v1 paths
- placeholder file URIs that are not `file://` in v1 paths
- mismatched ids between the reading order and the node or beacon map
- presenting an inferred reason as the author's stated intent
- comprehension-check or prediction questions: the tour explains, it does not quiz
- claiming runtime features that do not exist yet
