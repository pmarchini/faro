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
  const folders = groupByFolder(files)
  const width = Math.max(...folders.map(([folder]) => folder.length))

  return folders.map(([folder, entries]) => ({
    text: `${folder.padEnd(width)}  ${entries.map((entry) => `${mark(entry)} ${entry.file}`).join('  ')}`,
    isCurrent: entries.some((entry) => entry.isCurrent),
    isDim: entries.every((entry) => entry.steps.length === 0),
  }))
}

// The rail's files: each folder, then its files under it in step order.
export function railFiles(files: readonly TreeFile[]): TreeRow[] {
  return groupByFolder(files).flatMap(([folder, entries]) => [
    { text: folder, isCurrent: false, isDim: true },
    ...entries.map((entry) => ({
      text: `  ${mark(entry)} ${entry.file}`,
      isCurrent: entry.isCurrent,
      isDim: !entry.isCurrent,
    })),
  ])
}

function mark(entry: TreeFile): string {
  return entry.isCurrent ? '▸' : entry.isVisited ? '✓' : '·'
}

// The files by folder, folders in the order the path first reaches them and
// files in step order; a file no path step anchors in comes last.
function groupByFolder(files: readonly TreeFile[]): Array<[string, TreeFile[]]> {
  const folders = new Map<string, TreeFile[]>()
  const firstStep = (entry: TreeFile) => entry.steps[0] ?? Infinity

  for (const entry of files) {
    const path = entry.file.replace(/^\.?\//, '')
    const cut = path.lastIndexOf('/')
    const folder = cut < 0 ? './' : path.slice(0, cut + 1)
    folders.set(folder, [...(folders.get(folder) ?? []), { ...entry, file: path.slice(cut + 1) }])
  }

  const earliest = (entries: readonly TreeFile[]) => Math.min(...entries.map(firstStep))

  return [...folders.entries()]
    .map(([folder, entries]): [string, TreeFile[]] => [folder, [...entries].sort((a, b) => firstStep(a) - firstStep(b))])
    .sort(([a, x], [b, y]) => earliest(x) - earliest(y) || a.localeCompare(b))
}
