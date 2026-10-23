import { MAIN_PATH_ID, pathSteps, type Tour, type TourNode, type TourSubPath } from '../../src/core/model/tour.ts'
import { currentPathId, pathTrail, subPathsAt } from '../../src/core/services/tour-machine.ts'
import type { FaroReader as ReaderState } from '../types'

// Paths of paths, laid out for the pane: the step list as a tree that opens
// only the paths on the reader's trail, the map with every path open, and
// the header's breadcrumb.

// A step in a list: its path, place in it, depth of nesting and marks.
export type StepRow = {
  kind: 'step'
  pathId: string
  node: TourNode
  position: number
  level: number
  isCurrent: boolean
  mark: string
  flags: string
}

// A sub path not on the trail, one line that enters it; an offered dive not
// written yet; or the sub path Claude is writing.
export type BranchRow =
  | { kind: 'subPath'; subPath: TourSubPath; level: number; isOpen: boolean }
  | { kind: 'offered'; question: string; level: number }
  | { kind: 'writing'; level: number }

export type TreeRow = StepRow | BranchRow

// The breadcrumb collapses past this many paths.
const MAX_CRUMBS = 3

export function stepRows(tour: Tour, reader: ReaderState): TreeRow[] {
  const trail = new Set(pathTrail(tour).map((entry) => entry.pathId))

  return rowsOf(tour, reader, MAIN_PATH_ID, 0, (subPath) => trail.has(subPath.id), false)
}

// Every path open, and the dives offered but not written.
export function mapRows(tour: Tour, reader: ReaderState): TreeRow[] {
  return rowsOf(tour, reader, MAIN_PATH_ID, 0, () => true, true)
}

function rowsOf(
  tour: Tour,
  reader: ReaderState,
  pathId: string,
  level: number,
  isOpen: (subPath: TourSubPath) => boolean,
  isMap: boolean,
): TreeRow[] {
  const rows: TreeRow[] = []
  const steps = pathSteps(tour, pathId) ?? []

  steps.forEach((nodeId, position) => {
    const node = tour.nodes[nodeId]

    if (!node) return

    const below = subPathsAt(tour, pathId, nodeId)
    rows.push(stepRow(tour, reader, pathId, node, position, level, below.length > 0))

    for (const subPath of below) {
      const open = isOpen(subPath)
      rows.push({ kind: 'subPath', subPath, level: level + 1, isOpen: open })
      if (open) rows.push(...rowsOf(tour, reader, subPath.id, level + 1, isOpen, isMap))
    }

    if (isWriting(tour, reader, pathId, nodeId)) {
      rows.push({ kind: 'writing', level: level + 1 })
    } else if (isMap && node.dive && !below.some((subPath) => subPath.anchor.line === undefined)) {
      rows.push({ kind: 'offered', question: node.dive.question, level: level + 1 })
    }
  })

  return rows
}

function stepRow(
  tour: Tour,
  reader: ReaderState,
  pathId: string,
  node: TourNode,
  position: number,
  level: number,
  hasSubPaths: boolean,
): StepRow {
  const isCurrent = currentPathId(tour) === pathId && tour.current.nodeId === node.id
  const isVisited = (reader.visited[tour.id] ?? []).includes(node.id)
  const isStale = (reader.stale[tour.id] ?? []).includes(node.id)
  const offersDive = Boolean(node.dive) && !hasSubPaths

  return {
    kind: 'step',
    pathId,
    node,
    position,
    level,
    isCurrent,
    mark: isCurrent ? '▸' : isVisited ? '✓' : ' ',
    flags: `${offersDive ? ' ◆' : ''}${node.surprise ? ' !' : ''}${isStale ? ' ~' : ''}`,
  }
}

export function isWriting(tour: Tour, reader: ReaderState, pathId: string, nodeId: string): boolean {
  const diving = reader.diving

  return diving?.tourId === tour.id && diving.path === pathId && diving.node === nodeId
}

// "Session persistence › 2 › How a token is signed": the main path's title,
// then each dive as the step it left from and the sub path's title.
export function breadcrumb(tour: Tour): string {
  const trail = pathTrail(tour)
  const crumbs: string[] = [tour.title]

  trail.forEach((entry, index) => {
    const next = trail[index + 1]

    if (entry.nodeId !== undefined && next) {
      const position = (pathSteps(tour, entry.pathId) ?? []).indexOf(entry.nodeId) + 1
      crumbs.push(String(position), tour.subPaths?.[next.pathId]?.title ?? next.pathId)
    }
  })

  // Past three paths: the main title, an ellipsis, and the last dive.
  const shown = trail.length > MAX_CRUMBS ? [crumbs[0] ?? '', '…', ...crumbs.slice(-2)] : crumbs

  return shown.join(' › ')
}

// The text of a row in a one-line list or the map: tree lines before it.
export function rowText(row: TreeRow, isMap: boolean): string {
  const indent = '│ '.repeat(Math.max(0, row.level - (row.kind === 'step' ? 0 : 1)))

  switch (row.kind) {
    case 'step':
      return isMap
        ? `${indent}├ ${row.mark} ${row.position + 1} ${row.node.title}${row.flags}`
        : `${row.mark} ${String(row.position + 1).padStart(2)}  ${indent}${row.node.title}${row.flags}`
    case 'subPath':
      return `${indent}${isMap ? '├─┐ ' : '↳ '}${row.subPath.title} · ${row.subPath.steps.length} steps${row.subPath.anchor.line ? ` · from L${row.subPath.anchor.line}` : ''}`
    case 'offered':
      return `${indent}├┄┐ ◆ ${row.question}  (d writes it)`
    case 'writing':
      return `${indent}↳ Claude is writing a sub path…`
  }
}
