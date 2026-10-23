import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { getTour } from '../src/core/services/tour-machine.ts'
import { loadCode } from './code-view.ts'
import { closePane, openPane } from './pane/open.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from './state.ts'
import type { FaroDocument, FaroReader } from './types'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// The pane's state lives in the session's memory, so a resumed session
// (`claude --resume`, `--continue`) would start empty. Each session's tours,
// reading state and whether the pane was open are kept in the plugin's store
// under the session's id: written when the session ends and after every
// tour write, read back when a session with that id starts.
//
// Switching sessions from the session picker keeps the process, so no
// session.start fires: the id is checked every SWITCH_CHECK_MS instead, and
// a change of id swaps in the new session's tour, or none.

const SESSIONS_KEY = 'sessions'
// The store holds 4 MiB in all; only the most recent sessions are kept.
const KEPT_SESSIONS = 12
const SWITCH_CHECK_MS = 1000

type Snapshot = { document: FaroDocument; reader: FaroReader; isPaneOpen: boolean }

const sessionKey = (id: string) => `session:${id}`

export function serveResume(on: On): void {
  on('ui.open', async ($, e, next) => {
    const opened = await next(e)
    if (e.id === PANE) await setPaneOpen($, true)
    return opened
  })

  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE && e.origin.kind !== 'unload') await setPaneOpen($, false)
    return closed
  })

  on('session.end', async ($, e, next) => {
    await saveSession($, e.resume.id)
    return next(e)
  })
}

// Follows a switch to another session in the same process.
// One watch at a time: session.start runs again on a reload or an enable.
let stopWatching: (() => void) | undefined

export async function watchSessionSwitch($: EngineInterface): Promise<void> {
  let current = await $.session.id()

  stopWatching?.()
  const timer = $.clock.every(SWITCH_CHECK_MS, async () => {
    const id = await $.session.id()

    if (id === current) {
      return
    }

    // What the reader did since the last save, kept for the session left.
    await saveSession($, current)
    current = id
    await update($, documentAtom, () => EMPTY_DOCUMENT)
    await update($, readerAtom, () => EMPTY_READER)
    await update($, codeAtom, () => null)
    await update($, draftingAtom, () => null)

    if (!(await restoreSession($))) {
      await closePane($)
    }
  })
  stopWatching = () => timer.cancel()
}

// Brings back what the session had, when this session id kept a tour;
// answers whether it did.
export async function restoreSession($: EngineInterface): Promise<boolean> {
  const snapshot = (await $.store.get(sessionKey(await $.session.id()))) as Snapshot | undefined
  const tour = snapshot ? getTour(snapshot.document) : undefined

  if (!snapshot || !tour || getTour(await read($, documentAtom))) {
    return false
  }

  await update($, documentAtom, () => snapshot.document)
  await update($, readerAtom, () => ({ ...EMPTY_READER, ...snapshot.reader }))
  await loadCode($, tour)

  if (snapshot.isPaneOpen) {
    await openPane($)
  } else {
    await closePane($)
  }

  return true
}

// Keeping the tour is a convenience: a save that fails (the store is full,
// the session ends too fast) is dropped, never raised.
export async function saveSession($: EngineInterface, id?: string): Promise<void> {
  try {
    await save($, id ?? (await $.session.id()))
  } catch {
    // Nothing to do: the session simply will not come back with its tour.
  }
}

async function save($: EngineInterface, sessionId: string): Promise<void> {
  const document = await read($, documentAtom)

  if (document.tours.length === 0) {
    return
  }

  const reader = await read($, readerAtom)
  const snapshot: Snapshot = { document, reader, isPaneOpen: reader.isPaneOpen }
  const kept = ((await $.store.get(SESSIONS_KEY)) as string[] | undefined) ?? []
  const order = [...kept.filter((entry) => entry !== sessionId), sessionId]

  for (const dropped of order.slice(0, -KEPT_SESSIONS)) {
    await $.store.delete(sessionKey(dropped))
  }

  await $.store.set(sessionKey(sessionId), snapshot)
  await $.store.set(SESSIONS_KEY, order.slice(-KEPT_SESSIONS))
}

async function setPaneOpen($: EngineInterface, isPaneOpen: boolean): Promise<void> {
  if ((await read($, readerAtom)).isPaneOpen !== isPaneOpen) {
    await update($, readerAtom, (reader) => ({ ...reader, isPaneOpen }))
  }
}
