import type { EngineInterface } from 'claude-code'

// `$.fs` resolves a relative path against Claude Code's own process folder,
// not the session's; tour anchors are relative to the session's folder.
export async function inSession($: EngineInterface, path: string): Promise<string> {
  return path.startsWith('/') ? path : `${(await $.session.cwd()).replace(/\/$/, '')}/${path}`
}
