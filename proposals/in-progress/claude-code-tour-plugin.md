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
| Paired and solo pane, short layout, file tree beside the step list | `claude-code/pane/path-view.tsx`, `claude-code/bridge.ts` | done |
| Next, back and jump-to-step from VS Code (status bar, `alt+[`/`alt+]`, Faro Tour view) | `claude-code/bridge.ts`, `src/infra/vscode/follow/register-follow-ui.ts` | done |
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
| Opening code | Claude Code alone is enough; VS Code is an optional companion that never takes focus. This supersedes "never leave Claude Code" (Pietro, 2026-10-22, "Terminal and VS Code together" in the design doc) | see "Following in VS Code"; when solo, each node shows its anchor's whole range, or its diff hunk, inside the pane by default (Pietro, 2026-10-22); `o` narrows it to the current beacon with two lines of context |
| Pinned tours | Per user | kept in the plugin's `$.store`; nothing is written to the repo |
| Comprehension checks | Not included | no prediction prompts, no check field |
| Citations | Verified bibliography in the skill | `skills/faro-author-paths/comprehension.md` |

### Lens cost

Pennington's program and situation models map onto two lenses: `flow` (control and data flow) and `domain` (what the code means for the business concept). Writing both for every node roughly doubles the tokens spent authoring a tour, and most readers never switch. So a tour is written in one lens (`tour.lens`, `flow` by default). The first time the reader presses `l` on a node with no `otherLens`, the pane asks Claude to write that node's other lens through `tour_update_node`, shows "Writing the domain lens…" until it lands, and from then on `l` toggles instantly. The cost is a short wait on the first switch per node, paid only by readers who want it.

### Following in VS Code

Decided in the design session of 2026-10-22 (the design doc's "Terminal and VS Code together" section has the table and mockups): Claude Code leads and VS Code follows, and each detail lives on one surface. The pane keeps the path, the story, the lens and the asking keys; VS Code, while it follows, shows the code.

The bridge is three files in `.faro/` under the session's folder, not a second MCP server. The plugin cannot open a socket, and the extension's existing MCP bridge (a socket with a token, served to VS Code chat) would need the plugin to find the port and token. Files need neither, work whichever side starts first, and either side can drop them. The cost is that Claude Code must run in the folder VS Code has open, plus a few hundred milliseconds of polling.

| File | Written by | Read by | Content |
| --- | --- | --- | --- |
| `follow.json` | the plugin, on every change of step, beacon or lens | the extension (`fs.watchFile`, 300 ms) | `FollowSignal`: tour, step, steps, anchors, beacons and the current beacon's index, diff base, note |
| `ack.json` | the extension, on each step it shows and every 3 s after, for up to 30 min without a new step | the plugin | heartbeat; the pane is paired while beats keep arriving (12 s without one and it goes solo) |
| `control.json` | the extension, on next, back or a step chosen in VS Code | the plugin | `FollowControl`: tour id, action, node id; applied through the pane's own actions, ignored for another tour |

The plugin also writes `.faro/.gitignore` (`*`), so the person's own `.gitignore` is left alone.

**Polling in the mod.** `$.clock.every(400)` from session start: two `fs.exists`/`fs.stat` calls per tick, and a file is read only when its mtime moved. The first look at each file only records it, so a request or beat from before the session is not acted on. Nothing runs while following is off or no tour is open.

**Paired pane.** The header shows "⇄ VS Code", the code panel folds to one line ("code in VS Code: file Lnn · beacon 1 of 2"), and the node shows at least L1. `c` flips the code panel from its default in either mode, so "less" moved from `c` to `u`.

**VS Code.** One preview tab, `preserveFocus`. The tab follows the current beacon, across files when a step spans several. A diff tour opens `vscode.diff` against the tour's base (`diffBaseOf`: the target's `baseSha`, else `HEAD` for the working tree or the left side of a range) through the built-in git extension's `git:` URIs, and falls back to the plain file. Anchors get a faint tint; beacons a stronger one with their label as end-of-line text (full on hover), the current beacon strongest. The note is a read-only comment thread (no commenting ranges, `canReply: false`), collapsed, holding only the headline and plan and "full story in Claude Code". Status bar `‹ faro 3/6 ›`, `alt+[`/`alt+]` and the Faro Tour view in the Explorer appear once a step has been followed (`faro.following` context key).

Not done from the design: `o` moving VS Code to the hunk (VS Code already shows the whole file with the step's ranges), and revealing the file in the Explorer as an option.

## Implementation notes

- **Keys.** A pane Button's hotkey is one lowercase letter or digit, so the design's `enter`/`space`, `backspace`, `?` and `!` became `e` (deeper), `u` (less), `a` (ask) and `x` (don't get it); `c` folds or opens the code panel, as in the paired design. The rest are as designed: `j`/`k`, `l`, `b`, `o`, `r`, `q`; `t` (file tree) is new. Every key is also a visible, clickable button in the pane's footer, and each path row is a button that jumps to that node.
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
