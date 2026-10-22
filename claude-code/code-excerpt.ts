// Cutting the code the pane shows out of a file or a diff. Pure.

export type Excerpt = {
  source: string
  startLine: number
}

export function sliceLines(text: string, startLine: number, endLine: number): Excerpt {
  const lines = text.split('\n')
  const first = Math.max(1, startLine)
  const last = Math.min(lines.length, Math.max(first, endLine))

  return { source: lines.slice(first - 1, last).join('\n'), startLine: first }
}

// The beacon line with `context` lines either side, clamped to the anchor.
export function beaconExcerpt(
  text: string,
  line: number,
  anchor: { startLine: number; endLine: number },
  context = 2,
): Excerpt {
  const start = Math.max(anchor.startLine, line - context)
  const end = Math.min(anchor.endLine, line + context)

  return sliceLines(text, start, end)
}

type Hunk = { newStart: number; newEnd: number; text: string }

// The hunks of a unified diff whose new-side lines overlap the range, kept
// as unified-diff text so the pane can draw them with add and remove marks.
export function hunksOverlapping(diff: string, startLine: number, endLine: number): string {
  const hunks = parseHunks(diff)
  const overlapping = hunks.filter((hunk) => hunk.newStart <= endLine && hunk.newEnd >= startLine)

  return overlapping.map((hunk) => hunk.text).join('\n')
}

function parseHunks(diff: string): Hunk[] {
  const hunks: Hunk[] = []
  let current: { newStart: number; newCount: number; lines: string[] } | null = null

  const close = () => {
    if (current) {
      hunks.push({
        newStart: current.newStart,
        newEnd: current.newStart + Math.max(current.newCount, 1) - 1,
        text: current.lines.join('\n'),
      })
    }
  }

  for (const line of diff.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)

    if (header) {
      close()
      current = { newStart: Number(header[1]), newCount: Number(header[2] ?? 1), lines: [line] }
    } else if (current && /^[ +\-\\]/.test(line)) {
      current.lines.push(line)
    } else if (current && line === '') {
      continue
    } else {
      close()
      current = null
    }
  }

  close()

  return hunks
}
