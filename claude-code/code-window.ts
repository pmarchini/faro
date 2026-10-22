// What the code panel shows of a step's code: every line a row, the rows
// far from any beacon folded into one, and a window of the panel's height
// centred on the current beacon, with a scroll track that marks where the
// beacons are. Pure; the pane draws the rows.

export type CodeRow = {
  // The line in the file, or null for a line a diff removed.
  number: number | null
  marker: ' ' | '+' | '-'
  text: string
}

export type WindowBeacon = {
  line: number
  index: number
  isCurrent: boolean
}

export type VisualRow =
  | { kind: 'row'; row: CodeRow; beacon?: WindowBeacon }
  | { kind: 'fold'; count: number }

export type TrackCell = 'current' | 'beacon' | 'window' | 'rail'

export type CodeWindow = {
  rows: VisualRow[]
  // One cell per drawn row; empty when everything fits.
  track: TrackCell[]
  hidden: { above: number; below: number }
}

// Lines kept around a beacon, and the shortest run worth folding.
const CONTEXT = 3
const MIN_FOLD = 4

export function sourceRows(text: string, startLine: number, endLine: number): CodeRow[] {
  const lines = text.split('\n')
  const first = Math.max(1, startLine)
  const last = Math.min(lines.length, Math.max(first, endLine))

  return lines.slice(first - 1, last).map((line, index) => ({ number: first + index, marker: ' ', text: line }))
}

// The rows of unified-diff hunks, numbered on the new side.
export function diffRows(diff: string): CodeRow[] {
  const rows: CodeRow[] = []
  let next = 0

  for (const line of diff.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)

    if (header) {
      next = Number(header[1])
    } else if (line.startsWith('-')) {
      rows.push({ number: null, marker: '-', text: line.slice(1) })
    } else if (line.startsWith('+') || line.startsWith(' ')) {
      rows.push({ number: next, marker: line[0] as '+' | ' ', text: line.slice(1) })
      next += 1
    }
  }

  return rows
}

// Folds each run of at least MIN_FOLD lines that is more than CONTEXT lines
// from every beacon, keeping the first and last line and every changed line.
export function foldRows(rows: readonly CodeRow[], beacons: readonly WindowBeacon[], isUnfolded: boolean): VisualRow[] {
  const beaconAt = new Map(beacons.map((beacon) => [beacon.line, beacon]))
  const isKept = (row: CodeRow, index: number) =>
    isUnfolded ||
    index === 0 ||
    index === rows.length - 1 ||
    row.marker !== ' ' ||
    beacons.some((beacon) => row.number !== null && Math.abs(row.number - beacon.line) <= CONTEXT)
  const visual: VisualRow[] = []
  let run: CodeRow[] = []

  const closeRun = () => {
    if (run.length >= MIN_FOLD) {
      visual.push({ kind: 'fold', count: run.length })
    } else {
      visual.push(...run.map((row) => ({ kind: 'row' as const, row })))
    }

    run = []
  }

  rows.forEach((row, index) => {
    if (isKept(row, index)) {
      closeRun()
      const beacon = row.number !== null && row.marker !== '-' ? beaconAt.get(row.number) : undefined
      visual.push(beacon ? { kind: 'row', row, beacon } : { kind: 'row', row })
    } else {
      run.push(row)
    }
  })
  closeRun()

  return visual
}

// The `height` rows to draw, centred on the current beacon and moved by
// `offset` rows (the reader's scrolling), clamped to the ends.
export function codeWindow(visual: readonly VisualRow[], height: number, offset: number): CodeWindow {
  const total = visual.length
  const size = Math.max(1, height)

  if (total <= size) {
    return { rows: [...visual], track: [], hidden: { above: 0, below: 0 } }
  }

  const current = visual.findIndex((row) => row.kind === 'row' && row.beacon?.isCurrent)
  const centre = current < 0 ? Math.floor(size / 2) : current
  const start = Math.min(Math.max(0, centre - Math.floor(size / 2) + offset), total - size)
  const track = Array.from({ length: size }, (_, cell): TrackCell => {
    const from = Math.floor((cell * total) / size)
    const to = Math.max(from + 1, Math.floor(((cell + 1) * total) / size))
    const covered = visual.slice(from, to)

    if (covered.some((row) => row.kind === 'row' && row.beacon?.isCurrent)) return 'current'
    if (covered.some((row) => row.kind === 'row' && row.beacon)) return 'beacon'

    return to > start && from < start + size ? 'window' : 'rail'
  })

  return { rows: visual.slice(start, start + size), track, hidden: { above: start, below: total - start - size } }
}
