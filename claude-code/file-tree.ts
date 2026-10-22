// The tour's files, compactly, so the reader sees where in the repository
// the current step sits. Pure; the pane draws its rows.

export type TreeFile = {
  file: string
  steps: number[]
  isCurrent: boolean
  isVisited: boolean
}

export type TreeRow = {
  text: string
  isCurrent: boolean
  isDim: boolean
}

// One row per folder, its files after it in step order:
// `auth/  ✓ routes.ts  ▸ session.ts  · store.ts`. A step's file is ▸ when it
// is the current step's, ✓ once read, · otherwise; a file no path step
// anchors in is dim.
export function compactFiles(files: readonly TreeFile[]): TreeRow[] {
  const folders = new Map<string, TreeFile[]>()

  for (const entry of files) {
    const path = entry.file.replace(/^\.?\//, '')
    const cut = path.lastIndexOf('/')
    const folder = cut < 0 ? './' : path.slice(0, cut + 1)
    folders.set(folder, [...(folders.get(folder) ?? []), { ...entry, file: path.slice(cut + 1) }])
  }

  const firstStep = (entries: readonly TreeFile[]) => Math.min(...entries.map((entry) => entry.steps[0] ?? Infinity))
  const width = Math.max(...[...folders.keys()].map((folder) => folder.length))

  return [...folders.entries()]
    .sort(([a, x], [b, y]) => firstStep(x) - firstStep(y) || a.localeCompare(b))
    .map(([folder, entries]) => {
      const sorted = [...entries].sort((a, b) => (a.steps[0] ?? Infinity) - (b.steps[0] ?? Infinity))
      const names = sorted.map((entry) => `${entry.isCurrent ? '▸' : entry.isVisited ? '✓' : '·'} ${entry.file}`)

      return {
        text: `${folder.padEnd(width)}  ${names.join('  ')}`,
        isCurrent: sorted.some((entry) => entry.isCurrent),
        isDim: sorted.every((entry) => entry.steps.length === 0),
      }
    })
}
