import type { EngineInterface } from 'claude-code'

// Where a tour's file is. Anchors are meant to be relative to the
// repository's root, but Claude may run in a subfolder, or write a path from
// the folder it was asked about; so the session's folder is tried, then the
// repository's root, then a tracked file whose path ends the same way.
export async function locate($: EngineInterface, file: string): Promise<string | undefined> {
  if (file.startsWith('/')) {
    return (await isFile($, file)) ? file : undefined
  }

  const relative = file.replace(/^\.\//, '')
  const cwd = (await $.session.cwd()).replace(/\/$/, '')
  const root = (await git($, ['rev-parse', '--show-toplevel'])).trim()

  for (const base of [cwd, root].filter(Boolean)) {
    if (await isFile($, `${base}/${relative}`)) return `${base}/${relative}`
  }

  if (!root) return undefined

  const tracked = (await git($, ['ls-files', '--full-name'], root)).split('\n')
  const name = relative.split('/').pop() ?? relative
  const matches = tracked.filter((path) => path === relative || path.endsWith(`/${relative}`))
  const byName = matches.length > 0 ? matches : tracked.filter((path) => path.endsWith(`/${name}`) || path === name)

  return byName.length === 1 ? `${root}/${byName[0]}` : undefined
}

async function isFile($: EngineInterface, path: string): Promise<boolean> {
  try {
    return (await $.fs.stat(path)).kind === 'file'
  } catch {
    return false
  }
}

async function git($: EngineInterface, args: string[], cwd?: string): Promise<string> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', ...args], cwd ? { cwd } : undefined)
    return exitCode === 0 ? stdout : ''
  } catch {
    return ''
  }
}
