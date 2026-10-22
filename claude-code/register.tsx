import type { Register } from 'claude-code'

import { registerCommands, serveCommands } from './command.ts'
import { drawPathView } from './pane/path-view.tsx'
import { watchEdits } from './stale.ts'
import { registerTools, serveTools } from './tools.ts'

// The faro mod: tour_* tools Claude writes through, /explain and /tour for
// the person, and a pane with the Path view. The Graph view is v2.

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await registerTools($)
    await registerCommands($)

    return next(e)
  })

  serveTools(on)
  serveCommands(on)
  watchEdits(on)
  drawPathView(on)
}
