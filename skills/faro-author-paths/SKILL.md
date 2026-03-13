---
name: faro-author-paths
description: Create or update Faro path documents for this repository. Use when an agent needs to draft, refine, or replace a Faro path using the canonical schema from src/core/model/document.ts, while respecting the current MVP limits of linear paths, one active path, and one active beacon.
---

# Faro Author Paths

Use this skill when the user wants a Faro path to be created, revised, extended, or checked for validity.

## Source Of Truth

The canonical schema lives in:

- `src/core/model/document.ts`

Do not invent a parallel schema. Re-read that file if the shape is uncertain.

## Current Product Limits

Work within the current MVP constraints:

- linear `mainPath` only
- one active path at a time
- one active beacon at a time
- `schemaVersion` is `1`
- `activePathId` must be `null` or match an existing path id

Current contract operations are:

- `faro.listPaths`
- `faro.getPath`
- `faro.upsertPath`
- `faro.setActivePath`
- `faro.setCurrentBeacon`
- `faro.deletePath`

Do not claim that a full stdio MCP server is registered yet. If the user asks to "use Faro" from an agent runtime that does not expose these operations, produce valid Faro path data or a precise edit plan that fits the canonical model.

## Required Path Rules

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

## Workflow

1. Identify the user goal or subsystem to explain.
2. Decide whether to create a new path or replace/update an existing one.
3. Draft a Faro document or a single `FaroPath` that fits the canonical schema.
4. Keep the path narrow and linear unless the user explicitly asks for more.
5. Make titles and explanations concrete enough to be navigable.
6. Validate `mainPath`, `beacons`, and `current` consistency before returning.

## Output Preference

Prefer returning one of these:

- a full `FaroDocument` when the user wants the whole state
- a single `FaroPath` when the user wants one path created or replaced
- a precise edit plan when the runtime surface is not yet available

## Minimal Shape

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

## Good Defaults

- use short stable path ids such as `auth-flow` or `cache-invalidation`
- keep `title` readable and `goal` explicit
- make `summary` concise and `explanation` slightly more detailed
- use tags only when they help navigation

## Avoid

- branch-heavy structures for the current MVP
- placeholder file URIs that are not `file://`
- mismatched beacon ids between `mainPath` and `beacons`
- claiming runtime features that do not exist yet
