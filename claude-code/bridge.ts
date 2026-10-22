import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { FOLLOW_ACK_FILE, FOLLOW_CONTROL_FILE, parseFollowControl } from '../src/core/model/follow.ts'
import { getTour } from '../src/core/services/tour-machine.ts'
import { isFollowOn } from './follow.ts'
import { runAction, selectNode } from './pane/actions.ts'
import { EMPTY_DOCUMENT } from './state.ts'

const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const pairedAtom = atom({ plugin: 'faro', key: 'paired' } as const, false)

// Listens to the VS Code extension through two files beside follow.json:
// its heartbeat (ack.json), which makes the pane "paired" and folds its code
// panel, and its requests to move (control.json), which this applies through
// the same actions as the pane's keys. Two stats per tick, nothing read
// until a file's mtime moves.

export const POLL_MS = 400
// The extension beats every 3 s; four missed beats and the pane goes solo.
const PAIRED_TICKS = Math.ceil(12_000 / POLL_MS)

export function startBridge($: EngineInterface): void {
  let tick = 0
  let lastBeat = -Infinity
  const seen: Record<string, number | null | undefined> = {}

  // The mtime of a bridge file when it moved since the last look, else null.
  // The first look only records it: a request or beat from before this
  // session is not acted on.
  async function moved(path: string): Promise<boolean> {
    const mtime = (await $.fs.exists(path)) ? (await $.fs.stat(path)).mtimeMs : null
    const before = seen[path]
    seen[path] = mtime

    return before !== undefined && mtime !== null && mtime !== before
  }

  $.clock.every(POLL_MS, async () => {
    tick += 1

    if (!(await isFollowOn($)) || !getTour(await read($, documentAtom))) {
      return
    }

    const root = await $.session.cwd()

    if (await moved(`${root}/${FOLLOW_ACK_FILE}`)) {
      lastBeat = tick
    }

    const isPaired = tick - lastBeat <= PAIRED_TICKS

    if ((await read($, pairedAtom)) !== isPaired) {
      await update($, pairedAtom, () => isPaired)
    }

    if (await moved(`${root}/${FOLLOW_CONTROL_FILE}`)) {
      await applyControl($, await $.fs.read(`${root}/${FOLLOW_CONTROL_FILE}`))
    }
  })
}

async function applyControl($: EngineInterface, text: unknown): Promise<void> {
  const control = typeof text === 'string' ? parseFollowControl(text) : null
  const tour = getTour(await read($, documentAtom))

  if (!control || !tour || control.tourId !== tour.id) {
    return
  }

  if (control.action === 'step' && control.nodeId) {
    await selectNode($, control.nodeId)
  } else if (control.action !== 'step') {
    await runAction($, control.action)
  }
}
