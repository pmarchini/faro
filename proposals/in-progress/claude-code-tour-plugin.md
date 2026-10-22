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
| VS Code follows the step read in Claude Code (`/tour follow on|off`, `faro.followClaudeCode`; Pietro, 2026-10-22) | `src/core/model/follow.ts`, `claude-code/follow.ts`, `src/infra/vscode/follow/` | done |
| Graph view | | v2 |
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
| Opening code | Never leave Claude Code; VS Code may follow in the background (Pietro, 2026-10-22) | reading never needs another window, but when the Faro extension is open on the same folder it shows the same step without taking focus (see "Following in VS Code"); each node shows its anchor's whole range, or its diff hunk, inside the pane by default (Pietro, 2026-10-22); `o` narrows it to the current beacon with two lines of context |
| Pinned tours | Per user | kept in the plugin's `$.store`; nothing is written to the repo |
| Comprehension checks | Not included | no prediction prompts, no check field |
| Citations | Verified bibliography in the skill | `skills/faro-author-paths/comprehension.md` |

### Lens cost

Pennington's program and situation models map onto two lenses: `flow` (control and data flow) and `domain` (what the code means for the business concept). Writing both for every node roughly doubles the tokens spent authoring a tour, and most readers never switch. So a tour is written in one lens (`tour.lens`, `flow` by default). The first time the reader presses `l` on a node with no `otherLens`, the pane asks Claude to write that node's other lens through `tour_update_node`, shows "Writing the domain lens…" until it lands, and from then on `l` toggles instantly. The cost is a short wait on the first switch per node, paid only by readers who want it.

### Following in VS Code

Pietro asked to follow the highlighted areas in VS Code while reading in Claude Code. The bridge is a file, not a second MCP server: on every change of step or beacon the plugin writes a `FollowSignal` (`src/core/model/follow.ts`: tour, step, title, anchors, beacon line, time) to `.faro/follow.json` under the session's folder, and creates `.faro/.gitignore` with `*` so the person's own `.gitignore` is left alone. The extension polls that path (`fs.watchFile`, 300 ms, so it works before the file exists), ignores malformed or repeated writes and the step present when it started, and opens the beacon's file with `preserveFocus` and `preview`, highlighting the step's ranges in that file, marking the beacon line, and showing the step in the status bar. The signal also carries the step's note (plan, surprise, what it does or changed, why, beacon, carry forward, detail) in the lens the pane shows, and the extension pins it under the beacon line as a read-only comment thread (a comment controller with no commenting ranges, `canReply: false`), with the same Markdown as the beacon line's hover (Pietro, 2026-10-22). `faro.followClaudeCode.notes` turns the note off.

Why a file: the plugin cannot open a socket, and the extension's existing MCP bridge (a socket with a token, served to VS Code chat) would need the plugin to find the port and token. A file in the workspace needs neither, works whichever side starts first, and either side can drop it. The cost is that Claude Code must run in the workspace folder VS Code has open, and a few hundred milliseconds of polling delay.

## Implementation notes

- **Keys.** A pane Button's hotkey is one lowercase letter or digit, so the design's `enter`/`space`, `backspace`, `?` and `!` became `e` (deeper), `c` (less), `a` (ask) and `x` (don't get it). The rest are as designed: `j`/`k`, `l`, `b`, `o`, `r`, `q`; `t` (file tree) is new. Every key is also a visible, clickable button in the pane's footer, and each path row is a button that jumps to that node.
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
2. Graph view (`g`/`p`), from the edges already authored.
3. Let the VS Code extension read `schemaVersion: 2` documents.
