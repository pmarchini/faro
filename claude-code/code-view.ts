import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { diffBaseOf } from '../src/core/model/follow.ts'
import type { Tour, TourAnchor, TourBeacon, TourNode } from '../src/core/model/tour.ts'
import { hunksOverlapping } from './code-excerpt.ts'
import { diffRows, sourceRows } from './code-window.ts'
import { diffArgv } from './explain-args.ts'
import { publishFollow } from './follow.ts'
import { inSession } from './paths.ts'
import { EMPTY_READER } from './state.ts'
import type { FaroCodeView as CodeView } from './types'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// Fills the code panel for the current beacon's anchor: its diff hunks for
// a change, or its lines for existing code; with `o`, the whole file. The
// pane folds and windows these rows when it draws them. Reads happen here,
// in handlers and tool calls, never while drawing: a render hook only reads
// state.
export async function loadCode($: EngineInterface, tour: Tour, isWholeFile = false): Promise<void> {
  const node = tour.current.nodeId ? tour.nodes[tour.current.nodeId] : undefined

  if (!node) {
    await update($, codeAtom, () => null)
    return
  }

  const { beaconIndex, isOtherLensShown } = await read($, readerAtom)
  const beacon = node.beacons.length > 0 ? node.beacons[beaconIndex % node.beacons.length] : undefined
  const anchor = anchorFor(node, beacon)

  if (!anchor) {
    await update($, codeAtom, () => null)
    return
  }

  const view = await codeView($, tour, node, anchor, isWholeFile)
  await update($, codeAtom, () => view)

  // Every change of step or beacon comes through here, so VS Code follows.
  await publishFollow($, tour, { beaconIndex, isOtherLensShown })
}

function anchorFor(node: TourNode, beacon: TourBeacon | undefined): TourAnchor | undefined {
  const holding = beacon
    ? node.anchors.find(
        (anchor) =>
          anchor.file === beacon.file && beacon.line >= anchor.range.startLine && beacon.line <= anchor.range.endLine,
      )
    : undefined

  return holding ?? node.anchors[0]
}

async function codeView(
  $: EngineInterface,
  tour: Tour,
  node: TourNode,
  anchor: TourAnchor,
  isWholeFile: boolean,
): Promise<CodeView> {
  const base = { tourId: tour.id, nodeId: node.id, isWholeFile, path: anchor.file }
  const { startLine, endLine } = anchor.range
  const argv = isWholeFile ? null : diffArgv(tour.target, anchor.file)

  if (argv) {
    const hunks = await runText($, argv)
    const overlapping = hunks ? hunksOverlapping(hunks, startLine, endLine) : ''

    if (overlapping) {
      const against = diffBaseOf(tour.target) ?? 'base'
      return { ...base, heading: `L${startLine}–${endLine} · diff vs ${against}`, format: 'diff', rows: diffRows(overlapping) }
    }
  }

  const text = await readText($, anchor.file)

  if (text === undefined) {
    return { ...base, heading: 'could not be read', format: 'source', rows: [] }
  }

  const rows = isWholeFile ? sourceRows(text, 1, Number.MAX_SAFE_INTEGER) : sourceRows(text, startLine, endLine)
  const span = isWholeFile ? 'whole file' : `L${startLine}–${endLine}`
  const at = tour.target.headSha ? ` @ ${tour.target.headSha.slice(0, 7)}` : ''
  const readOnly = diffArgv(tour.target, anchor.file) ? '' : ` ·${at} read only`

  return { ...base, heading: `${span} · ${rows.length} lines${readOnly}`, format: 'source', rows }
}

async function readText($: EngineInterface, file: string): Promise<string | undefined> {
  try {
    const text = await $.fs.read(await inSession($, file))
    return typeof text === 'string' ? text : undefined
  } catch {
    return undefined
  }
}

async function runText($: EngineInterface, argv: string[]): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(argv)
    return exitCode === 0 ? stdout : undefined
  } catch {
    return undefined
  }
}
