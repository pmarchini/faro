import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Tour, TourAnchor, TourBeacon, TourNode } from '../src/core/model/tour.ts'
import { beaconExcerpt, hunksOverlapping, sliceLines } from './code-excerpt.ts'
import { diffArgv } from './explain-args.ts'
import { EMPTY_READER } from './state.ts'
import type { FaroCodeView as CodeView } from './types'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// Fills the code under the node panel. Reads happen here, in handlers and
// tool calls, never while drawing: a render hook only reads state.

export async function loadCode($: EngineInterface, tour: Tour, isFull: boolean): Promise<void> {
  const node = tour.current.nodeId ? tour.nodes[tour.current.nodeId] : undefined

  if (!node) {
    await update($, codeAtom, () => null)
    return
  }

  const { beaconIndex } = await read($, readerAtom)
  const beacon = node.beacons.length > 0 ? node.beacons[beaconIndex % node.beacons.length] : undefined
  const anchor = anchorFor(node, beacon)

  if (!anchor) {
    await update($, codeAtom, () => null)
    return
  }

  const view = isFull ? await fullView($, tour, node, anchor) : await excerptView($, tour, node, anchor, beacon)
  await update($, codeAtom, () => view)
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

async function excerptView(
  $: EngineInterface,
  tour: Tour,
  node: TourNode,
  anchor: TourAnchor,
  beacon: TourBeacon | undefined,
): Promise<CodeView> {
  const text = await readText($, anchor.file)
  const base = { tourId: tour.id, nodeId: node.id, isFull: false, path: anchor.file, format: 'source' as const }

  if (text === undefined) {
    return { ...base, heading: anchor.file, source: `(${anchor.file} could not be read)` }
  }

  const excerpt = beacon
    ? beaconExcerpt(text, beacon.line, anchor.range)
    : sliceLines(text, anchor.range.startLine, Math.min(anchor.range.endLine, anchor.range.startLine + 4))
  const heading = beacon ? `${anchor.file}:${beacon.line}  ${beacon.label}` : `${anchor.file}:${anchor.range.startLine}`

  return { ...base, heading, source: excerpt.source, startLine: excerpt.startLine }
}

async function fullView($: EngineInterface, tour: Tour, node: TourNode, anchor: TourAnchor): Promise<CodeView> {
  const base = { tourId: tour.id, nodeId: node.id, isFull: true, path: anchor.file }
  const { startLine, endLine } = anchor.range
  const argv = diffArgv(tour.target, anchor.file)

  if (argv) {
    const hunks = await runText($, argv)
    const overlapping = hunks ? hunksOverlapping(hunks, startLine, endLine) : ''

    if (overlapping) {
      return { ...base, heading: `${anchor.file} (diff)`, source: overlapping, format: 'diff' }
    }
  }

  const text = await readText($, anchor.file)

  if (text === undefined) {
    return { ...base, heading: anchor.file, source: `(${anchor.file} could not be read)`, format: 'source' }
  }

  const slice = sliceLines(text, startLine, endLine)

  return {
    ...base,
    heading: `${anchor.file}:${startLine}-${endLine}`,
    source: slice.source,
    startLine: slice.startLine,
    format: 'source',
  }
}

async function readText($: EngineInterface, file: string): Promise<string | undefined> {
  try {
    const text = await $.fs.read(file)
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
