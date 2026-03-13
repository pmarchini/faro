# Extension Agent Install UI

## Status

`todo`

## Problem

Faro currently requires terminal commands to install or update agent and skill artifacts.

That creates friction for the normal VS Code workflow and hides important install choices behind CLI knowledge:

- `local` vs `global`
- which host artifacts will be written
- when overwrite protection blocks a global install
- when a force-style confirmation is required

The extension should expose this workflow directly inside VS Code.

## Goal

Add a first-class extension UX for installing Faro agent and skill artifacts without requiring terminal commands.

## Scope

In scope:

- an extension-visible UI entrypoint for agent/skill installation
- explicit scope selection: `local` vs `global`
- support for the current Faro targets:
  - Claude
  - Copilot instructions
  - Copilot custom agent
  - Codex skill
- clear feedback for success, failure, and overwrite conflicts
- explicit confirmation before any global overwrite that currently requires `force`

Out of scope:

- automatic background installation without user intent
- silent overwrite of existing user-owned global files
- changing the current install semantics before the UI exists

## Proposed UX Direction

Preferred shapes to evaluate:

1. a Faro sidebar menu or view action
2. a dedicated Faro command that opens a quick-pick flow
3. a small management webview for install targets and status

The UI must not hide scope selection behind opaque commands.

## Acceptance Criteria

- the extension exposes a visible install entrypoint inside VS Code
- the user can choose `local` or `global` explicitly
- the UI shows which files or targets will be affected before writing
- local install covers the current repo-scoped Faro artifacts
- global install covers the current user-level Faro artifacts
- overwrite conflicts for global Copilot Faro files are surfaced clearly
- forced overwrite requires explicit user confirmation
- install results are shown in the extension UI, not only in terminal output
- the UI delegates to one canonical install service instead of duplicating install logic

## Architectural Constraints

- install logic should remain outside the core Faro document/runtime model
- VS Code UI should call a dedicated tooling/service layer
- current local/global semantics must stay aligned with the CLI layer
- the extension UI must not introduce a parallel install contract

## Risks

- duplicating install rules between CLI and extension UI
- unclear ownership of global files across reruns
- confusing users if local/global scope is not explained before execution
- mixing install tooling into the main path-navigation runtime

## Next Step

Design the extension-facing install service boundary and choose the first UI surface:

- command palette flow
- sidebar action
- dedicated management view
