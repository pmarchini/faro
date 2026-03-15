# VS Code Adapter

Current canonical reading path:

1. `extension.ts`
2. `composition/register-vscode-bindings.ts`
3. `ui/main-view/*`

Adapter-owned concerns live here:

- VS Code activation and registrations
- webview/provider handling
- editor reveal/highlight behavior
- workspace persistence adapters
- MCP registration for the VS Code host

UI code lives under:

- `ui/main-view/*` for the active sidebar
- `ui/legacy/*` for dormant navigator/setup surfaces
- `ui/outline/*` for tree-based UI helpers

Source and tests should import these canonical locations directly.
