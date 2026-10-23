import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { MAIN_PATH_ID, type FaroDocumentV2, type Tour, type TourNode, type TourSubPath } from '../src/core/model/tour.ts'
import { lintTour } from '../src/core/model/tour-validation.ts'
import {
  addSubPath,
  currentPathId,
  enterPath,
  focusNode,
  getTour,
  updateNode,
  upsertTour,
} from '../src/core/services/tour-machine.ts'
import { loadCode } from './code-view.ts'
import { openPane } from './pane/open.ts'
import { saveSession } from './resume.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PINNED_KEY, addOnce } from './state.ts'

const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// The tour_* tools: Claude's only way to write to the pane. Every write goes
// through the core's validation, and a refusal lists every problem at once.

const TOUR_SCHEMA_NOTE = 'The shape is in skills/faro-author-paths/tour-schema.md (source of truth: src/core/model/tour.ts).'

export async function registerTools($: EngineInterface): Promise<void> {
  await Promise.all([
    $.tool.register({
      name: 'tour_upsert',
      description: `Create or replace a whole Faro tour (schemaVersion 2) and open it in the pane on its first path node. Prefer one whole-tour write. Refuses an invalid tour, listing every problem; returns advice on soft rules. ${TOUR_SCHEMA_NOTE}`,
      inputSchema: {
        type: 'object',
        properties: { tour: { type: 'object', description: 'The whole Tour.' } },
        required: ['tour'],
      },
      isDeferred: false,
    }),
    $.tool.register({
      name: 'tour_update_node',
      description:
        'Replace one node of a tour, or add one to the path after insertAfter, keeping the reader where they are. Use it to refine a node, re-explain one more simply, or fill otherLens.',
      inputSchema: {
        type: 'object',
        properties: {
          tourId: { type: 'string' },
          node: { type: 'object', description: 'The whole TourNode.' },
          insertAfter: { type: 'string', description: 'A path node id; needed only to add a new node.' },
        },
        required: ['tourId', 'node'],
      },
      isDeferred: false,
    }),
    $.tool.register({
      name: 'tour_add_path',
      description:
        'Write a sub path under one step of a tour: a short ordered path (2 to 5 steps) that goes in depth on that step, or on one line of its code. Pass its new nodes; a step may also name a node the tour has. A sub path with the same id is rewritten. If the reader is still on the step, the pane enters the sub path.',
      inputSchema: {
        type: 'object',
        properties: {
          tourId: { type: 'string' },
          path: {
            type: 'object',
            description:
              'The TourSubPath: { id, title, question, anchor: { path: "main" or a sub path id, node, file?, line? }, steps: node ids }.',
          },
          nodes: { type: 'array', items: { type: 'object' }, description: 'The new TourNodes its steps name.' },
        },
        required: ['tourId', 'path', 'nodes'],
      },
      isDeferred: false,
    }),
    $.tool.register({
      name: 'tour_get',
      description:
        "Return a tour (the active one by default) with the reader's state: current node and depth, visited nodes, nodes marked \"don't get this\", and nodes whose files changed since.",
      inputSchema: { type: 'object', properties: { tourId: { type: 'string' } } },
      isDeferred: false,
    }),
    $.tool.register({
      name: 'tour_focus',
      description: 'Move the reader to a node of a tour, for "look at step 4".',
      inputSchema: {
        type: 'object',
        properties: { tourId: { type: 'string' }, nodeId: { type: 'string' } },
        required: ['tourId', 'nodeId'],
      },
      isDeferred: false,
    }),
    $.tool.register({
      name: 'tour_list',
      description: 'List the live and pinned tours, id and title.',
      inputSchema: { type: 'object', properties: {} },
      isDeferred: false,
    }),
  ])
}

export function serveTools(on: On): void {
  on('tool.call', { tool: 'mcp__faro__tour_upsert' }, async ($, e) => {
    const tour = (e as { tour?: Tour }).tour

    if (!tour || typeof tour !== 'object') {
      return { deny: `tour_upsert needs { tour }. ${TOUR_SCHEMA_NOTE}` }
    }

    const written = await writeDocument($, (document) => upsertTour(document, tour))

    if ('deny' in written) {
      return { deny: `The tour was refused:\n${written.deny}` }
    }

    const stored = getTour(written.document, tour.id)
    await update($, draftingAtom, () => null)
    await update($, readerAtom, (reader) => ({
      ...reader,
      diving: null,
      selectedLine: null,
      visited: { ...reader.visited, [tour.id]: stored?.current.nodeId ? [stored.current.nodeId] : [] },
      confused: { ...reader.confused, [tour.id]: [] },
      stale: { ...reader.stale, [tour.id]: [] },
      isOtherLensShown: false,
      beaconIndex: 0,
    }))

    if (stored) {
      await loadCode($, stored)
    }

    await openPane($)
    await saveSession($)
    const advice = stored ? lintTour(stored) : []

    return {
      result: [
        `Tour ${tour.id} is in the pane with ${stored?.path.length ?? 0} nodes on the path.`,
        ...(advice.length > 0 ? ['Advice (accepted, but worth fixing with tour_update_node):', ...advice.map((line) => `- ${line}`)] : []),
      ].join('\n'),
    }
  })

  on('tool.call', { tool: 'mcp__faro__tour_update_node' }, async ($, e) => {
    const { tourId, node, insertAfter } = e as { tourId?: string; node?: TourNode; insertAfter?: string }

    if (typeof tourId !== 'string' || !node || typeof node !== 'object') {
      return { deny: 'tour_update_node needs { tourId, node }.' }
    }

    const written = await writeDocument($, (document) => updateNode(document, tourId, { node, insertAfter }))

    if ('deny' in written) {
      return { deny: `The node was refused:\n${written.deny}` }
    }

    await update($, readerAtom, (reader) => ({
      ...reader,
      stale: { ...reader.stale, [tourId]: (reader.stale[tourId] ?? []).filter((id) => id !== node.id) },
      confused: { ...reader.confused, [tourId]: (reader.confused[tourId] ?? []).filter((id) => id !== node.id) },
    }))

    const tour = getTour(written.document, tourId)

    if (tour && tour.current.nodeId === node.id) {
      await loadCode($, tour)
    }

    await saveSession($)
    return { result: `Node ${node.id} of tour ${tourId} is updated.` }
  })

  on('tool.call', { tool: 'mcp__faro__tour_add_path' }, async ($, e) => {
    const { tourId, path, nodes } = e as { tourId?: string; path?: TourSubPath; nodes?: TourNode[] }

    if (typeof tourId !== 'string' || !path || typeof path !== 'object' || !Array.isArray(nodes)) {
      return { deny: `tour_add_path needs { tourId, path, nodes }. ${TOUR_SCHEMA_NOTE}` }
    }

    const written = await writeDocument($, (document) => addSubPath(document, tourId, { subPath: path, nodes }))

    if ('deny' in written) {
      return { deny: `The sub path was refused:\n${written.deny}` }
    }

    // The reader who asked for it and is still on that step goes in.
    const reader = await read($, readerAtom)
    const tour = getTour(written.document, tourId)
    const isAsked =
      reader.diving?.tourId === tourId && reader.diving.path === path.anchor.path && reader.diving.node === path.anchor.node
    const isWaiting =
      tour?.current.nodeId === path.anchor.node && currentPathId(tour) === (path.anchor.path ?? MAIN_PATH_ID)

    if (isAsked) {
      await update($, readerAtom, (current) => ({ ...current, diving: null }))
    }

    if (isAsked && isWaiting && tour) {
      const entered = await writeDocument($, (document) => enterPath(document, tourId, path.id))
      const inside = 'document' in entered ? getTour(entered.document, tourId) : undefined

      if (inside?.current.nodeId) {
        const nodeId = inside.current.nodeId
        await update($, readerAtom, (current) => ({
          ...current,
          visited: { ...current.visited, [tourId]: addOnce(current.visited[tourId], nodeId) },
          selectedLine: null,
          isOtherLensShown: false,
          beaconIndex: 0,
          codeOffset: 0,
        }))
        await loadCode($, inside)
      }
    }

    await saveSession($)
    const advice = tour ? lintTour(tour).filter((line) => path.steps.some((id) => line.includes(`Node ${id} `)) || line.includes(`Sub path ${path.id} `)) : []

    return {
      result: [
        `Sub path ${path.id} hangs from ${path.anchor.node} with ${path.steps.length} steps.`,
        ...(advice.length > 0 ? ['Advice:', ...advice.map((line) => `- ${line}`)] : []),
      ].join('\n'),
    }
  })

  on('tool.call', { tool: 'mcp__faro__tour_get' }, async ($, e) => {
    const { tourId } = e as { tourId?: string }
    const document = await read($, documentAtom)
    const tour = getTour(document, tourId) ?? (await pinnedTours($))[tourId ?? '']

    if (!tour) {
      return { deny: tourId ? `No tour ${tourId}.` : 'No tour is open. Author one with tour_upsert.' }
    }

    const reader = await read($, readerAtom)

    return {
      result: JSON.stringify({
        tour,
        reader: {
          current: tour.current,
          visited: reader.visited[tour.id] ?? [],
          dontGet: reader.confused[tour.id] ?? [],
          stale: reader.stale[tour.id] ?? [],
          isOtherLensShown: reader.isOtherLensShown,
        },
      }),
    }
  })

  on('tool.call', { tool: 'mcp__faro__tour_focus' }, async ($, e) => {
    const { tourId, nodeId } = e as { tourId?: string; nodeId?: string }

    if (typeof tourId !== 'string' || typeof nodeId !== 'string') {
      return { deny: 'tour_focus needs { tourId, nodeId }.' }
    }

    const written = await writeDocument($, (document) => ({ ...focusNode(document, tourId, nodeId), activeTourId: tourId }))

    if ('deny' in written) {
      return { deny: written.deny }
    }

    await update($, readerAtom, (reader) => ({
      ...reader,
      visited: { ...reader.visited, [tourId]: addOnce(reader.visited[tourId], nodeId) },
      beaconIndex: 0,
    }))

    const tour = getTour(written.document, tourId)

    if (tour) {
      await loadCode($, tour)
    }

    await openPane($)

    return { result: `The reader is on ${nodeId}.` }
  })

  on('tool.call', { tool: 'mcp__faro__tour_list' }, async ($) => {
    const document = await read($, documentAtom)
    const pinned = await pinnedTours($)
    const live = document.tours.map((tour) => `- ${tour.id}: ${tour.title}${tour.id === document.activeTourId ? ' (open)' : ''}`)
    const kept = Object.values(pinned).map((tour) => `- ${tour.id}: ${tour.title} (pinned)`)
    const lines = [...live, ...kept]

    return { result: lines.length > 0 ? lines.join('\n') : 'No tours yet.' }
  })
}

export async function pinnedTours($: EngineInterface): Promise<Record<string, Tour>> {
  const value = await $.store.get(PINNED_KEY)

  return value && typeof value === 'object' ? (value as Record<string, Tour>) : {}
}

async function writeDocument(
  $: EngineInterface,
  change: (document: FaroDocumentV2) => FaroDocumentV2,
): Promise<{ document: FaroDocumentV2 } | { deny: string }> {
  let next: FaroDocumentV2 | undefined
  let problem: string | undefined

  await update($, documentAtom, (document) => {
    try {
      next = change(document)
      problem = undefined
      return next
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error)
      return document
    }
  })

  return problem !== undefined || !next ? { deny: problem ?? 'Nothing was written.' } : { document: next }
}
