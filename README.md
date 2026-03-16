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
- `Path` shows a seeded sample path when no agent-authored path exists yet
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

## Development

Core commands:

```sh
npm run check
npm test
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
