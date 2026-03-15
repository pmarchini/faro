# Faro Beacon Graph Canvas

## Status

`todo`

## Problem

Faro currently optimizes for one linear reading spine.

That is useful for guided comprehension, but it hides important structure once a flow starts to branch:

- sibling beacons are hard to compare spatially
- causal relationships are flattened into a list
- alternative routes and side effects are harder to see at once
- a developer cannot build a quick "map" of the flow without stepping beacon by beacon

For larger paths, Faro needs a second representation that complements the linear path instead of replacing it.

## Goal

Add a bidimensional graph canvas representation of Faro beacons so a user can explore a flow spatially while still keeping Faro's code-first reading model.

## Scope

In scope:

- one graph-based Faro view for visualizing beacons on a pan/zoom canvas
- graph nodes that show:
  - beacon title
  - source file
  - beacon summary/description
  - a code preview
  - a clear `Jump to file` action
- visible edges between related beacons
- one selected/current beacon state
- graph interactions for:
  - pan
  - zoom
  - fit-to-view
  - node selection
  - jump-to-code
- reuse of canonical Faro document and beacon data

Out of scope:

- freeform user-authored graph editing in the first version
- graph-specific persistence independent from the Faro document
- collaborative canvas editing
- replacing the linear path view
- advanced graph analytics or automatic clustering in the first slice

## Proposed UX Direction

Faro should gain a dedicated `Graph` surface alongside the current path-oriented experience.

The preferred first shape is:

- a graph route inside the Faro extension UI
- a central infinite canvas
- a selected node card state with stronger emphasis
- a small graph toolbar with:
  - `Fit`
  - `Auto layout`
  - `Center on current`
- a minimap for orientation on larger paths

Each beacon node should behave like a code-aware card, not like a generic dot:

- title at the top
- file path immediately visible
- one or two lines of explanation/summary
- small syntax-highlighted code excerpt
- one explicit action button to jump into the file

The graph should preserve Faro's reading semantics:

- selecting a node updates the current beacon
- the current beacon remains highlighted
- `Jump to file` uses the existing reveal/navigation behavior
- the linear path remains available as the focused reading mode

## UI Directions

### Option A: Guided Spine Canvas

This is the safest first graph view from a comprehension perspective.

- a narrow left reading rail shows the main path and current position
- the center canvas emphasizes the current beacon and its immediate neighbors
- side branches stay collapsed or visually muted until explicitly explored
- the graph behaves like an orientation layer over the reading spine, not a freeform board

Why it works:

- lowest cognitive load
- preserves Faro's guided-reading identity
- makes branch exploration progressive instead of noisy

Tradeoff:

- weaker full-map overview than a fully expanded graph

### Option B: Jump Map

This is the strongest option for file discovery and fast code jumping.

- a left rail holds path and filter controls
- the center canvas shows card-based beacon nodes with clearly visible directional edges
- a right inspector expands the selected beacon with more code and metadata
- every node header keeps the file identity visible and directly actionable

Why it works:

- strongest discoverability
- graph doubles as a spatial index over the path
- makes file jumping cheap without hiding structure in panels

Tradeoff:

- can become visually busy if too many branches are expanded at once

### Option C: Port-Lens Graph Canvas

This uses the graph to reinforce Faro's architectural boundaries instead of blurring them.

- a left rail owns path-level controls and route switching
- the center canvas owns pan, zoom, layout, and selection
- a right inspector owns beacon explanation and code detail
- graph semantics stay tied to canonical Faro document concepts instead of a UI-only state model

Why it works:

- best architectural clarity
- keeps adapter concerns separate from core Faro semantics
- scales better to future non-VS Code adapters

Tradeoff:

- less visually opinionated than the other two directions

### Recommended First Direction

Start with a hybrid of `Guided Spine Canvas` and `Jump Map`.

- preserve one obvious main reading spine
- keep `Open file` and `Reveal range` actions directly on node cards
- reveal branches progressively instead of fully expanding them by default

This is the best balance between readability, discoverability, and Faro's comprehension-first product model.

## UI Foundation Decision

The graph-canvas proposal forces a broader UI-platform question:

- should Faro keep extending the current hand-authored webview HTML
- or should Faro introduce React as the UI foundation for richer future surfaces

This decision matters beyond the graph itself.

If the graph is expected to be the first of several richer UI surfaces, introducing React is a reasonable strategic move rather than an implementation accident.

## Library Evaluation

### Strategic Recommendation

Take React seriously as the preferred medium-term direction for the VS Code webview UI.

Why:

- the graph canvas is unlikely to be the last complex UI surface in Faro
- React makes stateful canvas UI, inspectors, toolbars, keyboard handling, and reusable node-card composition easier to scale
- React opens access to stronger graph/UI ecosystems, especially `React Flow`
- future graph refinements will likely involve more UI complexity than a one-off canvas spike

Constraint:

- React must remain an adapter concern inside the VS Code UI layer
- canonical Faro state, path semantics, and reveal commands must stay outside the React component tree as core/application concerns

### Best Fit Without React

Use `X6` as the first implementation candidate.

Why:

- good fit for diagram/canvas editing and node-card layouts
- HTML and SVG rendering is a good match for rich beacon cards
- strong TypeScript footprint
- framework-agnostic, which fits the current VS Code webview stack better than a React-only library
- large enough ecosystem and maturity signal

Current signal as of March 15, 2026:

- `antvis/X6`: `6.5k` GitHub stars

### Best Fit With React

Use `React Flow` if Faro decides to introduce React into the webview stack.

Why:

- best-in-class node-based UI ergonomics
- very strong adoption and ecosystem
- excellent custom-node story

Tradeoff:

- requires a webview UI migration toward React
- adds platform work before the graph itself lands

Current signal as of March 15, 2026:

- `xyflow/xyflow`: `35.6k` GitHub stars

### Additional Candidates

- `G6`
  - strong graph visualization engine
  - better fit for graph analytics and richer layout needs than for compact card-first node editors
  - `12k` GitHub stars
- `Cytoscape.js`
  - strong graph/data visualization engine
  - better for dense graph visualization than for polished card-based node editing
  - `10.9k` GitHub stars

### Recommendation

For Faro's likely direction:

1. if Faro expects more rich UI work after the graph, introduce `React` in the VS Code webview and use `React Flow` as the leading implementation candidate
2. if Faro wants the smallest possible first spike with minimal platform change, use `X6`
3. keep `G6` and `Cytoscape.js` out of the first slice unless the goal expands toward heavier graph analytics or dense-network visualization

### Preferred Path

The proposal should now assume this staged path:

1. introduce a small React host inside the VS Code webview adapter
2. keep all Faro document/path semantics outside React
3. prototype the graph canvas with `React Flow`
4. validate whether React becomes the foundation for future Faro UI work, not just the graph

## Acceptance Criteria

- Faro exposes a graph view that renders the active path as a graph on a 2D canvas
- every visible node shows title, file, summary/description, and a code preview
- every node exposes a clear jump-to-code action
- selecting a node updates Faro's current beacon state
- the current beacon is visibly distinguished in the graph
- graph pan/zoom and fit-to-view work smoothly in the VS Code webview
- the graph view reuses canonical Faro store state and does not introduce a parallel beacon model
- the graph view coexists with the linear path view instead of replacing it

## Architectural Constraints

- the canonical Faro document remains the source of truth
- graph edges and node projections should be derived from canonical beacon/path data
- adapter UI must not invent a second runtime contract for graph state
- code jumping must reuse the existing reveal/navigation adapter
- if React is introduced, it must stay inside the adapter UI layer and must not absorb application/runtime semantics
- a React adoption should produce a cleaner adapter boundary, not a tighter coupling between UI components and Faro core

## Risks

- over-optimizing for graph aesthetics instead of comprehension
- introducing React without a clear migration boundary and letting UI concerns leak into application semantics
- trying to support arbitrary graph editing too early
- making the graph view diverge from the linear path semantics
- packing too much code into each node and overwhelming the canvas

## Open Questions

- should the graph surface live as a route inside the current Faro view or as a dedicated VS Code view?
- should edges be strictly derived from `mainPath` adjacency first, or should we introduce richer relation types later?
- how much code preview is useful before the node becomes visually noisy?
- should auto-layout be deterministic and persisted, or recomputed every time in the first version?

## Next Step

Build three lightweight mockups and one technical foundation spike:

- compare `Guided Spine Canvas`, `Jump Map`, and `Port-Lens Graph Canvas`
- validate a minimal React host inside the VS Code webview adapter
- prototype one graph screen with `React Flow`
- validate custom node cards with code snippets and action buttons
- validate canvas performance inside the VS Code webview
- validate that node selection and jump-to-code can reuse Faro's current navigation loop
- choose whether React becomes the default foundation for future Faro UI surfaces
