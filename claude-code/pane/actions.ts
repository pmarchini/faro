import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FaroDocumentV2 } from '../../src/core/model/tour.ts'
import { changeDepth, focusNode, getTour, moveOnPath } from '../../src/core/services/tour-machine.ts'
import { loadCode } from '../code-view.ts'
import { askPrompt, otherLensPrompt, refreshPrompt, simplerPrompt } from '../prompts.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, addOnce } from '../state.ts'
import type { PaneAction } from './keys.ts'
import { closePane } from './open.ts'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// What each key does. Navigation changes state and redraws; the asking keys
// hand Claude a prompt that names the tour and node.

export async function runAction($: EngineInterface, action: PaneAction): Promise<void> {
  const document = await read($, documentAtom)
  const tour = getTour(document)

  if (action === 'close') {
    await closePane($)
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
    case 'deeper':
    case 'shallower':
      await update($, documentAtom, (current) => changeDepth(current, tour.id, action === 'deeper' ? 1 : -1))
      return
    case 'beacon': {
      await update($, readerAtom, (reader) => ({ ...reader, beaconIndex: reader.beaconIndex + 1 }))
      const code = await read($, codeAtom)
      await loadCode($, tour, code?.isFull ?? false)
      return
    }
    case 'code': {
      const code = await read($, codeAtom)
      await loadCode($, tour, !(code?.isFull ?? false))
      return
    }
  }

  if (!node) {
    return
  }

  switch (action) {
    case 'lens': {
      const reader = await read($, readerAtom)
      await update($, readerAtom, (current) => ({ ...current, isOtherLensShown: !current.isOtherLensShown }))

      // The other lens is written on demand, the first time it is asked for.
      if (!reader.isOtherLensShown && !node.otherLens) {
        await $.prompt.submit({ text: otherLensPrompt(tour, node) })
      }
      return
    }
    case 'ask':
      await $.prompt.fill({ text: askPrompt(tour, node, node.suggestedQuestion ?? '') })
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

export async function selectNode($: EngineInterface, nodeId: string): Promise<void> {
  const tour = getTour(await read($, documentAtom))

  if (tour) {
    await moveTo($, tour.id, (current) => focusNode(current, tour.id, nodeId))
  }
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
  }))
  await loadCode($, tour, false)
}
