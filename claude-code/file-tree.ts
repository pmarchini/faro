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

// The rail's files as a tree of folders, one segment a row, so the reader
// sees where the current step sits without parsing `a/b/c/` strings:
//
//   auth/
//   ├ ✓ routes.ts
//   └ store/
//     └ ▸ session.ts
//
// Folders and files are in the order the path first reaches them.
export function railFiles(files: readonly TreeFile[]): TreeRow[] {
  return treeRows(buildTree(files), '')
}

type Folder = { name: string; folders: Folder[]; files: TreeFile[] }

const firstStep = (entry: TreeFile) => entry.steps[0] ?? Infinity

function buildTree(files: readonly TreeFile[]): Folder {
  const root: Folder = { name: '', folders: [], files: [] }

  for (const entry of files) {
    const segments = entry.file.replace(/^\.?\//, '').split('/')
    const name = segments.pop() ?? entry.file
    let folder = root

    for (const segment of segments) {
      let next = folder.folders.find((child) => child.name === segment)

      if (!next) {
        next = { name: segment, folders: [], files: [] }
        folder.folders.push(next)
      }

      folder = next
    }

    folder.files.push({ ...entry, file: name })
  }

  return root
}

function earliest(folder: Folder): number {
  return Math.min(...folder.files.map(firstStep), ...folder.folders.map(earliest))
}

type Child = { order: number; name: string } & ({ folder: Folder } | { entry: TreeFile })

function treeRows(folder: Folder, indent: string): TreeRow[] {
  const children: Child[] = [
    ...folder.folders.map((child) => ({ order: earliest(child), name: child.name, folder: child })),
    ...folder.files.map((entry) => ({ order: firstStep(entry), name: entry.file, entry })),
  ].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const isRoot = folder.name === ''

  return children.flatMap((child, index) => {
    const isLast = index === children.length - 1
    const branch = isRoot ? '' : isLast ? '└ ' : '├ '

    if ('entry' in child) {
      const { entry } = child
      return [{ text: `${indent}${branch}${mark(entry)} ${entry.file}`, isCurrent: entry.isCurrent, isDim: !entry.isCurrent }]
    }

    const under = isRoot ? '' : isLast ? '  ' : '│ '
    return [{ text: `${indent}${branch}${child.name}/`, isCurrent: false, isDim: true }, ...treeRows(child.folder, indent + under)]
  })
}

function mark(entry: TreeFile): string {
  return entry.isCurrent ? '▸' : entry.isVisited ? '✓' : '·'
}

// The files by folder, folders in the order the path first reaches them and
// files in step order; a file no path step anchors in comes last.
function groupByFolder(files: readonly TreeFile[]): Array<[string, TreeFile[]]> {
  const folders = new Map<string, TreeFile[]>()

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
