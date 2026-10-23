# Faro for Claude Code: tours in a pane

Proposal status directory: `proposals/in-progress/`

## Purpose

Bring Faro to Claude Code as a plugin: Claude explains a change set or existing code as a tour (a Faro path grown into a graph), and the person walks it in a pane beside the chat. The full interface design, with mockups and the research behind each rule, is the design doc "Code Explainer plugin: interface design" (2026-10-21). This file is the in-repo record of what v1 builds and of the decisions it follows.

## What v1 ships

| Part | Where | Status |
| --- | --- | --- |
| Tour model, Faro document `schemaVersion: 2` | `src/core/model/tour.ts` | done |
| Validation (hard rules) and lint (soft rules) | `src/core/model/tour-validation.ts` | done |
| Pure navigation and edits | `src/core/services/tour-machine.ts` | done |
| v1 to v2 migration | `migrateDocumentToV2` in `tour.ts` | done |
| Shared skill, extended for tours | `skills/faro-author-paths/` (`SKILL.md`, `comprehension.md`, `tour-schema.md`) | done |
| Plugin manifest and marketplace | `.claude-plugin/`, `hooks/hooks.json` | done |
| `tour_upsert`, `tour_update_node`, `tour_get`, `tour_focus`, `tour_list` | `claude-code/tools.ts` | done |
| `/explain [target] [flags]`, `/tour [open|pin|list|drop]` | `claude-code/command.ts` | done |
| Path view pane, node panel at three depths, code excerpt and full view | `claude-code/pane/` | done |
| Stale marking after Edit/Write | `claude-code/stale.ts` | done |
| File tree of the tour's files, current step's file marked (`t` toggles; Pietro, 2026-10-22) | `claude-code/file-tree.ts` | done |
| Pane layout: rail of steps and files beside the reader, code window with folding and beacon list, short layout | `claude-code/pane/path-view.tsx`, `claude-code/code-window.ts` | done |
| Graph navigator: paths of paths, sub paths written on demand (`d`/`s`/`m`, clickable code lines, `tour_add_path`) | `src/core`, `claude-code/pane/path-tree.ts`, `claude-code/pane/path-view.tsx` | done |
| Path overview (link neighbourhood of the single path) | | parked |
| `tour-author` subagent for very large diffs | | later |
| VS Code extension reading v2 documents | | later |

## Decisions

All settled by Pietro on 2026-10-22.

| Topic | Decision | Consequence in the code |
| --- | --- | --- |
| Repo | Same repo as the VS Code extension; repo root is the plugin root | `.vscodeignore` leaves the plugin files out of the VSIX; the mod imports the model from `src/core` |
| Schema | A tour is `schemaVersion: 2` of the Faro document | v1 documents migrate by wrapping each path as a tour with no edges |
| Scope | Diffs and existing code and flows | `/explain` takes a working tree, range, branch, PR, path, or a free-text question; `why.source` is `inferred` when nothing states the reason |
| Views | Path view first, Graph view in v2 | edges are in the schema and authored from day one, so v2 needs no data change |
| Lenses | Write only the chosen lens up front; fetch the other on the first `l` press | see "Lens cost" below |
| Opening code | Inside the Claude Code pane; no VS Code companion. Following in VS Code was built (PR #4) and then dropped by Pietro on 2026-10-22 once the pane showed the code well ("not needed anymore") | the pane shows each node's anchor, or its diff hunk, folded and windowed around the current beacon; `o` shows the whole file |
| Pinned tours | Per user | kept in the plugin's `$.store`; nothing is written to the repo |
| Comprehension checks | Not included | no prediction prompts, no check field |
| Citations | Verified bibliography in the skill | `skills/faro-author-paths/comprehension.md` |

### Lens cost

Pennington's program and situation models map onto two lenses: `flow` (control and data flow) and `domain` (what the code means for the business concept). Writing both for every node roughly doubles the tokens spent authoring a tour, and most readers never switch. So a tour is written in one lens (`tour.lens`, `flow` by default). The first time the reader presses `l` on a node with no `otherLens`, the pane asks Claude to write that node's other lens through `tour_update_node`, shows "Writing the domain lens…" until it lands, and from then on `l` toggles instantly. The cost is a short wait on the first switch per node, paid only by readers who want it.

### Pane

**Code tours** (a `code` or `question` target: existing code, no change) read as such: the header says "code tour", the code panel is the plain file marked read only (with `@ <headSha>` when the tour has one), the story uses "Does", "Why (inferred: no commit says so)" and "Carry on".

**Pane layout** (the final visual design, implemented on Pietro's go, 2026-10-22): the pane is a column beside the chat. A one-line header (`o-^-o faro  title  [code tour]  lens  3/6`) and the hypothesis; then, from 90 cells wide, a rail of 30 cells with the Faro mark (`LOGO_ROWS` and "F A R O"), the steps (titles wrap under their number) and the files as a folder tree (`├`/`└`, one folder a row; `h` hides the rail), beside the reader: the story (headline wrapping under its number beside the plan chip, `[role: …]` in a code tour; each field wrapping under itself) and the code, which fills the remaining height. The code is cut into rows (`claude-code/code-window.ts`): the code starts unfolded and `f` folds lines more than three from every beacon into "N lines folded" (Pietro, 2026-10-22), the window is centred on the current beacon and scrolled with `n`/`p` (the design's J/K: a pane hotkey must be one lowercase letter or digit), a one-cell track on the right ticks the beacons, and `o` shows the whole file. Beacon lines are drawn as tinted text rows (the Code element cannot tint a line); runs of plain lines go through the Code element for syntax colour. The beacons are listed under the code, `●` for the current one. Narrower than 90 cells the steps and files stack above the reader; shorter than 18 rows the pane shows a breadcrumb. Colours live in `claude-code/pane/theme.ts`: the accent stays amber until Pietro decides on the brand cyan.

### Paths of paths

Settled with Pietro on 2026-10-23 (design canvas, row "Graph navigator: paths of paths"). The graph a reader walks is a tree of paths: the main path, and sub paths that each hang from one step of another path and go in depth on it. Sub paths are lazy: the skill writes none up front, it only marks dive-worthy steps with `dive: { question }` (◆ in the pane). When the reader presses `d` (or clicks a code line, then `d`), the pane submits a prompt and Claude writes the sub path through `tour_add_path`; the pane shows "Claude is writing a sub path… keep reading" and moves the reader in when it lands, if they are still on that step.

| Topic | Decision | Consequence in the code |
| --- | --- | --- |
| Shape | `tour.path` stays the main path; `tour.subPaths` holds the rest, keyed by id, each with `anchor { path, node, file?, line? }` | v2 documents need no migration; `"main"` names the main path in an anchor or cursor |
| Cursor | `current.pathId` names the path being read (absent: main); the stack is the chain of anchors | `pathTrail` derives it; `s` surfaces one level |
| Where you can dive | Any step, and any line of its code (Pietro: "we need to allow the user to click on the code"); ◆ only marks what the author recommends | the line's gutter is a button; a hover lights the row and shows "↳ dive" |
| After a sub path's last step | `j` returns to the step it hangs from (so does `k` before its first) | `moveOnPath` surfaces off either end of a sub path |
| Persistence | Written sub paths are part of the tour | saved, pinned and resumed with it |
| Depth | No limit; the breadcrumb collapses past three paths (`Title › … › 2 › Sub`) | |
| Length | At most 7 steps (refused), 2 to 5 advised | `MAX_SUB_PATH_LENGTH`, `lintTour` |

The pane: the header is a breadcrumb (`Session persistence › 2 › How a token is signed  flow  1/2`); the rail is a tree that opens only the paths on the reader's trail (others are one `↳` line a click enters); sub path numbers are purple (`SUB_ACCENT`); `m` swaps the step for a map of every path as an indented tree, offered dives as `├┄┐ ◆`. Plain code lines are now drawn one Code element per line, so each keeps its syntax colour beside its own clickable gutter.

## Implementation notes

- **Keys.** A pane Button's hotkey is one lowercase letter or digit, so the design's `enter`/`space`, `backspace`, `?` and `!` became `e` (deeper), `u` (less), `a` (ask) and `x` (don't get it); `c` folds or opens the code panel. The rest are as designed: `j`/`k`, `l`, `b`, `o`, `r`, `q`; `t` (file tree) is new. Every key is also a visible, clickable button in the pane's footer, and each path row is a button that jumps to that node.
- **Prompts from `/explain`.** A command cannot submit a prompt while it holds the turn, so `/explain` answers at once ("Drafting a tour of …"), opens the pane in its drafting state, and submits the authoring prompt from a zero-delay timer.
- **State contract.** A mod's `$.state` contract must be a self-contained `.d.ts`, so `claude-code/types/index.d.ts` restates the tour types. `claude-code/types/contract-check.ts` fails the mod's type-check if they drift from `src/core/model/tour.ts`.
- **Atoms per file.** The plugin scanner reads a `$.state` reference only from a const in the file that uses it, so each file declares the atoms it reads or writes; `claude-code/state.ts` holds the shared names and initial values.
- **Tests.** The core and the pure parts of the mod (`explain-args.ts`, `code-excerpt.ts`) are tested with `node:test` like the rest of the repo. The mod's hooks are tested with `claude plugin test`, whose runner loads every `*.test.ts` under the folder it is given; since the repo root also holds `node:test` suites, `scripts/test-claude-code.sh` stages the plugin's files in a temporary folder first (`npm run test:claude-code`).
- **Paths in tours.** Anchors and beacons use repository-relative paths, not `file://` URIs; migration converts v1 URIs.

## Acceptance criteria

- `/explain` with no changes says so and asks Claude nothing. (tested)
- `/explain "how does this plugin work?"` and `/explain <path>` produce code tours with no diff. (prompt tested; end-to-end needs a live session)
- An invalid tour is refused with every problem listed; soft-rule breaks come back as advice. (tested)
- The pane walks the path, marks visited nodes, goes deeper, toggles lens, asks, and marks "don't get it" so `tour_get` reports it. (tested on the terminal and desktop surfaces)
- An edit to a file under a node marks that node stale. (tested)
- `/tour pin` keeps a tour across sessions; `/tour open <id>` brings it back. (tested)

## Next

1. Try it in a live session on this repo (`claude --plugin-dir .`, then `/explain "how does the faro plugin work?"`) and tune the skill's wording on real output.
2. Try clicking code lines in a real terminal: mouse capture may get in the way of selecting text to copy.
3. The parked Path overview (the link neighbourhood of the single path), from the edges already authored.
3. Let the VS Code extension read `schemaVersion: 2` documents.
