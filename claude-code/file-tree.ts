// The tour's files as a compact tree, so the reader sees where in the
// repository the current step sits. Pure; the pane draws its rows.

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

type Dir = { dirs: Map<string, Dir>; files: TreeFile[] }

export function fileTree(files: readonly TreeFile[]): TreeRow[] {
  const root: Dir = { dirs: new Map(), files: [] }

  for (const entry of files) {
    const parts = entry.file.replace(/^\.?\//, '').split('/')
    let dir = root

    for (const part of parts.slice(0, -1)) {
      const next = dir.dirs.get(part) ?? { dirs: new Map(), files: [] }
      dir.dirs.set(part, next)
      dir = next
    }

    dir.files.push({ ...entry, file: parts.at(-1) ?? entry.file })
  }

  return drawDir(root, '')
}

function drawDir(dir: Dir, indent: string): TreeRow[] {
  const rows: TreeRow[] = []
  const dirs = [...dir.dirs.entries()].sort(([a], [b]) => a.localeCompare(b))
  const files = [...dir.files].sort((a, b) => (a.steps[0] ?? Infinity) - (b.steps[0] ?? Infinity))
  const count = dirs.length + files.length
  let index = 0

  for (const [name, child] of dirs) {
    const [label, inner] = collapse(name, child)
    const isLast = ++index === count
    rows.push({ text: `${indent}${isLast ? '└─ ' : '├─ '}${label}/`, isCurrent: false, isDim: true })
    rows.push(...drawDir(inner, `${indent}${isLast ? '   ' : '│  '}`))
  }

  for (const file of files) {
    const isLast = ++index === count
    const mark = file.isCurrent ? '▸ ' : file.isVisited ? '✓ ' : '  '
    const steps = file.steps.length > 0 ? `  ${file.steps.join(',')}` : '  ·'
    rows.push({
      text: `${indent}${isLast ? '└─ ' : '├─ '}${mark}${file.file}${steps}`,
      isCurrent: file.isCurrent,
      isDim: !file.isCurrent && file.steps.length === 0,
    })
  }

  return rows
}

// A directory holding one directory and nothing else is drawn on one line:
// `src/core/model/` rather than three levels.
function collapse(name: string, dir: Dir): [string, Dir] {
  let label = name
  let inner = dir

  while (inner.files.length === 0 && inner.dirs.size === 1) {
    const [childName, child] = [...inner.dirs.entries()][0] as [string, Dir]
    label = `${label}/${childName}`
    inner = child
  }

  return [label, inner]
}
