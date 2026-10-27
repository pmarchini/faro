import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FaroDocumentV2, Tour, TourNode } from '../../src/core/model/tour.ts'
import {
  changeDepth,
  currentPathId,
  enterPath,
  focusNode,
  getTour,
  moveOnPath,
  subPathsAt,
  surface,
} from '../../src/core/services/tour-machine.ts'
import { loadCode } from '../code-view.ts'
import { askPrompt, divePrompt, otherLensPrompt, refreshPrompt, simplerPrompt } from '../prompts.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, addOnce } from '../state.ts'
import type { FaroLine } from '../types'
import type { PaneAction } from './keys.ts'
import { closePane } from './open.ts'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// How far n and p scroll the code panel.
const SCROLL_ROWS = 8

// What each key does. Navigation changes state and redraws; the asking keys
// hand Claude a prompt that names the tour and node.

export async function runAction($: EngineInterface, action: PaneAction): Promise<void> {
  const document = await read($, documentAtom)
  const tour = getTour(document)

  if (action === 'close') {
    await closePane($)
    return
  }

  if (action === 'files' || action === 'steps' || action === 'codePanel' || action === 'map') {
    const field = { files: 'isFileTreeHidden', steps: 'isStepListShown', codePanel: 'isCodeToggled', map: 'isMapShown' } as const
    await update($, readerAtom, (reader) => ({ ...reader, [field[action]]: !reader[field[action]] }))
    return
  }

  if (!tour) {
    return
  }

  const node = tour.current.nodeId ? tour.nodes[tour.current.nodeId] : undefined

  switch (action) {
    case 'next':
    case 'previous':
      await moveTo($, tour.id, (current) => moveOnPath(current, tour.id, action === 'next' ? 1 : -1))
      return
    case 'surface':
      await moveTo($, tour.id, (current) => surface(current, tour.id))
      return
    case 'deeper':
    case 'shallower':
      await update($, documentAtom, (current) => changeDepth(current, tour.id, action === 'deeper' ? 1 : -1))
      return
    case 'beacon': {
      await update($, readerAtom, (reader) => ({ ...reader, beaconIndex: reader.beaconIndex + 1, codeOffset: 0 }))
      const code = await read($, codeAtom)
      await loadCode($, tour, code?.isWholeFile ?? false)
      return
    }
    case 'code': {
      const code = await read($, codeAtom)
      await update($, readerAtom, (reader) => ({ ...reader, codeOffset: 0 }))
      await loadCode($, tour, !(code?.isWholeFile ?? false))
      return
    }
    case 'fold':
      await update($, readerAtom, (reader) => ({ ...reader, isCodeFolded: !reader.isCodeFolded, codeOffset: 0 }))
      return
    case 'scrollDown':
    case 'scrollUp': {
      // With a line picked, n and p move the pick instead of scrolling.
      if (await moveSelection($, action === 'scrollDown' ? 1 : -1)) return
      const step = action === 'scrollDown' ? SCROLL_ROWS : -SCROLL_ROWS
      await update($, readerAtom, (reader) => ({ ...reader, codeOffset: reader.codeOffset + step }))
      return
    }
  }

  if (!node) {
    return
  }

  const reader = await read($, readerAtom)
  const line = reader.selectedLine?.nodeId === node.id ? reader.selectedLine : undefined

  switch (action) {
    case 'dive':
      await dive($, tour, node, line)
      return
    case 'lens': {
      await update($, readerAtom, (current) => ({ ...current, isOtherLensShown: !current.isOtherLensShown }))

      // The other lens is written on demand, the first time it is asked for.
      if (!reader.isOtherLensShown && !node.otherLens) {
        await $.prompt.submit({ text: otherLensPrompt(tour, node) })
      }
      return
    }
    case 'ask':
      await $.prompt.fill({
        text: line
          ? askPrompt(tour, node, `About ${line.file}:${line.line} \`${line.text.trim()}\`: `)
          : askPrompt(tour, node, node.suggestedQuestion ?? ''),
      })
      return
    case 'dontGet':
      await update($, readerAtom, (reader) => ({
        ...reader,
        confused: { ...reader.confused, [tour.id]: addOnce(reader.confused[tour.id], node.id) },
      }))
      await $.prompt.submit({ text: simplerPrompt(tour, node) })
      return
    case 'refresh':
      await $.prompt.submit({ text: refreshPrompt(tour, node) })
      return
  }
}

export async function selectNode($: EngineInterface, nodeId: string, pathId?: string): Promise<void> {
  const tour = getTour(await read($, documentAtom))

  if (tour) {
    await moveTo($, tour.id, (current) => focusNode(current, tour.id, nodeId, pathId ?? currentPathId(tour)))
  }
}

export async function enterSubPath($: EngineInterface, pathId: string): Promise<void> {
  const tour = getTour(await read($, documentAtom))

  if (tour) {
    await moveTo($, tour.id, (current) => enterPath(current, tour.id, pathId))
  }
}

// A click on a code line picks it; a click on the picked line lets it go.
export async function selectLine($: EngineInterface, line: FaroLine): Promise<void> {
  await update($, readerAtom, (reader) => ({
    ...reader,
    selectedLine:
      reader.selectedLine?.nodeId === line.nodeId && reader.selectedLine.file === line.file && reader.selectedLine.line === line.line
        ? null
        : line,
  }))
}

// `d`: a sub path already written from here is entered; otherwise Claude
// is asked to write one, and the pane says so until it lands.
async function dive($: EngineInterface, tour: Tour, node: TourNode, line: FaroLine | undefined): Promise<void> {
  const pathId = currentPathId(tour)
  const written = subPathsAt(tour, pathId, node.id).find((subPath) =>
    line ? subPath.anchor.file === line.file && subPath.anchor.line === line.line : subPath.anchor.line === undefined,
  )

  if (written) {
    await moveTo($, tour.id, (current) => enterPath(current, tour.id, written.id))
    return
  }

  const reader = await read($, readerAtom)
  const diving = { tourId: tour.id, path: pathId, node: node.id, ...(line ? { file: line.file, line: line.line } : {}) }

  const pending = reader.diving

  if (pending && JSON.stringify({ ...pending, isStarted: undefined }) === JSON.stringify({ ...diving, isStarted: undefined })) {
    return
  }

  await update($, readerAtom, (current) => ({ ...current, diving, selectedLine: null }))
  await $.prompt.submit({ text: divePrompt(tour, pathId, node, line) })
}

// Moves the picked line to the next or previous numbered line of the code
// panel; false when no line is picked.
async function moveSelection($: EngineInterface, delta: number): Promise<boolean> {
  const reader = await read($, readerAtom)
  const code = await read($, codeAtom)
  const picked = reader.selectedLine

  if (!picked || !code || code.nodeId !== picked.nodeId) {
    return false
  }

  const rows = code.rows.filter((row) => row.number !== null)
  const index = rows.findIndex((row) => row.number === picked.line)
  const next = rows[Math.min(Math.max(index + delta, 0), rows.length - 1)]

  if (next?.number != null) {
    const number = next.number
    await update($, readerAtom, (current) => ({ ...current, selectedLine: { ...picked, line: number, text: next.text } }))
  }

  return true
}

async function moveTo(
  $: EngineInterface,
  tourId: string,
  move: (document: FaroDocumentV2) => FaroDocumentV2,
): Promise<void> {
  await update($, documentAtom, move)
  const tour = getTour(await read($, documentAtom), tourId)

  if (!tour?.current.nodeId) {
    return
  }

  const nodeId = tour.current.nodeId
  await update($, readerAtom, (reader) => ({
    ...reader,
    visited: { ...reader.visited, [tourId]: addOnce(reader.visited[tourId], nodeId) },
    isOtherLensShown: false,
    beaconIndex: 0,
    codeOffset: 0,
    selectedLine: null,
  }))
  await loadCode($, tour)
}
