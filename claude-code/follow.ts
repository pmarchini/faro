import type { EngineInterface } from 'claude-code'

import { FOLLOW_DIR, FOLLOW_FILE, createFollowSignal } from '../src/core/model/follow.ts'
import type { Tour } from '../src/core/model/tour.ts'

// Tells the VS Code extension which step the reader is on, by writing it to
// .faro/follow.json in the session's directory. The extension watches that
// file and opens and highlights the same code. Off with /tour follow off.

export const FOLLOW_KEY = 'follow-vscode'

export async function isFollowOn($: EngineInterface): Promise<boolean> {
  return (await $.store.get(FOLLOW_KEY)) !== false
}

export async function publishFollow(
  $: EngineInterface,
  tour: Tour,
  reader: { beaconIndex: number; isOtherLensShown: boolean },
): Promise<void> {
  if (!(await isFollowOn($))) {
    return
  }

  try {
    const root = await $.session.cwd()
    const signal = createFollowSignal(tour, { ...reader, root, now: await $.clock.now() })

    if (!signal) {
      return
    }

    await ensureIgnored($, root)
    await $.fs.write(`${root}/${FOLLOW_FILE}`, `${JSON.stringify(signal, null, 2)}\n`)
  } catch {
    // Following is a convenience: a write that fails must never break the pane.
  }
}

// The folder ignores itself, so the person's .gitignore is left alone.
async function ensureIgnored($: EngineInterface, root: string): Promise<void> {
  const ignore = `${root}/${FOLLOW_DIR}/.gitignore`

  if (!(await $.fs.exists(ignore))) {
    await $.fs.write(ignore, '*\n')
  }
}
