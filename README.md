# Faro

Faro is a VS Code extension for turning agent reasoning about a codebase into guided, navigable code beacons.

## Why Faro

- Author a path in chat with an agent.
- Inspect the path in the Faro sidebar.
- Reveal the matching code directly in the editor.

## Screenshots

- `[Placeholder: Faro Home screenshot]`
- `[Placeholder: Faro Path screenshot]`
- `[Placeholder: Faro Setup screenshot]`

## Video

`[Placeholder: short onboarding video or GIF]`

## Status

Faro is currently a local MVP.

It is not published to the VS Code Marketplace yet, so the current way to try it is:

1. install the repo locally
2. install the extension into your VS Code
3. add the local agent artifacts for this workspace
4. use Faro from VS Code Chat and the Faro sidebar

## What You Need

- Node.js 23.x or newer
- npm
- VS Code 1.109 or newer

## Quick Start

Install dependencies:

```sh
npm install
```

Install the extension locally into your VS Code:

```sh
make install-local
```

Install the local Faro agent artifacts for this workspace:

```sh
make upsert-agent-local SCOPE=local
```

Open the repository in VS Code:

```sh
code .
```

If needed, run `Developer: Reload Window` once so VS Code picks up the local extension and generated agent files.

## First Use

1. Open the Chat view in VS Code.
2. Select the `Faro Path Author` custom agent.
3. Make sure the local `Faro` MCP server is enabled for the workspace.
4. Ask for a path around a concrete code-reading goal.

Example:

```text
Create a Faro path that explains how the main VS Code view is built and wired.
```

5. Open the `Faro` activity bar item.
6. Use the main Faro view:
   - `Home` to enter the product
   - `Path` to read the active path
   - `Setup` to manage local/global agent integrations
7. Use `Prev`, `Next`, and `Reveal` to walk the path in code.

## What You Should See

- the `Faro` activity bar item is visible
- the main Faro view opens correctly
- `Home`, `Path`, and `Setup` are available
- the active path is visible in `Path`
- `Prev`, `Next`, and `Reveal` work

## Extension Development Host

If you want to test Faro in an Extension Development Host instead of installing it into your normal VS Code profile:

```sh
make dev-host
```

Expected local MVP behavior:

- the `Faro` activity bar item is visible
- the main Faro view opens correctly
- `Path` shows an empty state until an agent-authored path exists
- `Prev`, `Next`, and `Reveal` work from the path route
- `Setup` shows local/global integration targets

## Local Agent Artifacts

Workspace-local artifacts:

```sh
make upsert-agent-local SCOPE=local
```

This writes:

- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.github/agents/faro-path-author.agent.md`
- `.codex/skills/faro-author-paths/SKILL.md`

Global artifacts:

```sh
make upsert-agent-global SCOPE=global
```

If a Faro-owned global Copilot file already exists and differs, Faro refuses to overwrite it unless you opt in:

```sh
make upsert-agent-global SCOPE=global FORCE=1
```

## Use Faro

Example prompts:

```text
Create a Faro path that explains how the main VS Code view is built and wired.
```

```text
Create a Faro path that traces the authentication flow from entrypoint to session state.
```

```text
Onboard me to the setup flow in this extension as a Faro path.
```

## Faro in Claude Code

Faro is also a Claude Code plugin. `/explain` asks Claude for a tour of your changes or of existing code, and you walk it in a pane beside the chat: a hypothesis up top, five to seven steps in reading order, and for each step what it does, why, the lines to look at, and the code itself. The explanation follows program-comprehension research; the rules and the bibliography are in [`skills/faro-author-paths/comprehension.md`](./skills/faro-author-paths/comprehension.md).

Install it from a Claude Code terminal session:

```text
/plugin install faro --marketplace pmarchini/faro
```

Answer `y` to add the marketplace, then pick a scope. To try a local checkout instead, start Claude Code with `claude --plugin-dir /path/to/faro`.

Use it:

```text
/explain                                   your uncommitted changes
/explain HEAD~3..HEAD                      a commit range
/explain feature/login                     a branch against its merge base
/explain #482 --goal "why do we retry?"    a pull request (needs gh)
/explain src/billing/ --lens domain        existing code
/explain "how does this plugin work?"      a question about a flow
/explain last                              reopen the last tour
```

Flags: `--depth brief|standard|deep`, `--lens flow|domain`, `--reader new|familiar`, `--goal "..."`.

In the pane, a column beside the chat: a rail on the left holds the Faro mark, the steps (titles wrap) and the tour's files as a folder tree with the current step's file marked; the reader on the right shows the step's story (its headline wraps under its number, beside the plan as a chip) and its code, which fills the rest of the height. The code is centred on the current beacon, beacon lines are tinted and listed under the code (● for the current one), lines far from every beacon fold into "N lines folded", and a track on the right marks where the beacons are. Keys: `j`/`k` move along the path, `e`/`u` show more or less, `l` switches between the flow and domain lens, `b` jumps to the next beacon, `n`/`p` scroll the code, `z` unfolds, `o` shows the whole file, `c` folds or opens the code panel, `f` hides or shows the rail, `a` puts the step's suggested question in the prompt, `x` asks Claude to re-explain the step more simply, `r` refreshes a step whose code changed, `q` closes. In a narrow pane the steps and files stack above the reader; in a pane shorter than 18 rows, such as VS Code's integrated terminal, they give way to a one-line breadcrumb (`faro 3/6 ✓✓▸○○○`) and `t` shows the steps. `/tour pin [name]` keeps a tour across sessions; `/tour list`, `/tour open <id>` and `/tour drop <id>` manage them.

The Graph view of a tour is planned for the next version. Design and decisions: [Claude Code tour plugin](./proposals/in-progress/claude-code-tour-plugin.md).

## Development

Core commands:

```sh
npm run check
npm test
npm run test:claude-code   # the Claude Code plugin's hooks, through `claude plugin test`
make dev-host
```

## Troubleshooting

If Faro does not appear in VS Code:

- reinstall the extension with `make install-local`
- reload the VS Code window
- confirm the extension is enabled

If the custom agent does not appear in Chat:

- rerun `make upsert-agent-local SCOPE=local`
- reload the VS Code window
- check that `.github/agents/faro-path-author.agent.md` exists

If the MCP flow does not work:

- confirm the local `Faro` MCP server is enabled for the workspace
- verify the extension is active
- verify `npm run check` and `npm test`

## More Docs

- [Architecture](./docs/architecture.md)
- [Implementation Plan](./docs/faro-plan.md)
- [MVP Spec](./proposals/in-progress/faro-mvp-spec.md)
- [Claude Code tour plugin](./proposals/in-progress/claude-code-tour-plugin.md)
