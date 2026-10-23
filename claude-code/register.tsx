import type { Register } from 'claude-code'

import { registerCommands, serveCommands } from './command.ts'
import { watchDives } from './dive-watch.ts'
import { drawPathView } from './pane/path-view.tsx'
import { restoreSession, serveResume, watchSessionSwitch } from './resume.ts'
import { watchEdits } from './stale.ts'
import { registerTools, serveTools } from './tools.ts'

// The faro mod: tour_* tools Claude writes through, /explain and /tour for
// the person, a pane with the Path view and its paths of paths, and the tour
// kept across a resume.

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await registerTools($)
    await registerCommands($)
    const started = await next(e)
    await restoreSession($)
    await watchSessionSwitch($)

    return started
  })

  serveTools(on)
  serveCommands(on)
  watchEdits(on)
  drawPathView(on)
  watchDives(on)
  serveResume(on)
}
