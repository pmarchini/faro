import type { Register } from 'claude-code'

import { startBridge } from './bridge.ts'
import { registerCommands, serveCommands } from './command.ts'
import { drawPathView } from './pane/path-view.tsx'
import { watchEdits } from './stale.ts'
import { registerTools, serveTools } from './tools.ts'

// The faro mod: tour_* tools Claude writes through, /explain and /tour for
// the person, a pane with the Path view, and the bridge VS Code follows and
// drives the tour through. The Graph view is v2.

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await registerTools($)
    await registerCommands($)
    startBridge($)

    return next(e)
  })

  serveTools(on)
  serveCommands(on)
  watchEdits(on)
  drawPathView(on)
}
