import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import { EMPTY_READER } from './state.ts'

const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// The pane says "writing a sub path…" from `d` until tour_add_path lands. If
// the turn that answers the dive ends without one (interrupted, refused, or
// Claude wrote none), the note goes, so `d` can ask again. A turn already
// running when `d` was pressed is not that turn: the dive prompt waits
// behind it, so only a turn that starts while a dive is pending counts.
// Subagents' turns, which carry an agentId, are part of the main turn.
export function watchDives(on: On): void {
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    await update($, readerAtom, (reader) =>
      reader.diving && !reader.diving.isStarted ? { ...reader, diving: { ...reader.diving, isStarted: true } } : reader,
    )

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    await update($, readerAtom, (reader) => (reader.diving?.isStarted ? { ...reader, diving: null } : reader))

    return next(e)
  })
}
