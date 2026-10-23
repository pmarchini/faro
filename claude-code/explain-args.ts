import type { TourLens, TourReader, TourTarget, TourTargetKind } from '../src/core/model/tour.ts'

// Parsing and classifying `/explain [target] [flags]`. Pure, so it is tested
// with the core under node:test; the probes that touch git or the disk are
// passed in by the command.

export type TourDepthName = 'brief' | 'standard' | 'deep'

export type ExplainRequest = {
  target: string
  goal?: string
  depth: TourDepthName
  lens: TourLens
  reader: TourReader
}

export type ParsedExplain = { request: ExplainRequest } | { error: string }

const DEPTHS: readonly TourDepthName[] = ['brief', 'standard', 'deep']
const LENSES: readonly TourLens[] = ['flow', 'domain']
const READERS: readonly TourReader[] = ['new', 'familiar']

export const NODE_BUDGET: Record<TourDepthName, string> = {
  brief: 'about 4',
  standard: '5 to 7',
  deep: 'up to 9',
}

export function parseExplainArgs(args: string): ParsedExplain {
  const tokens = tokenize(args)
  const words: string[] = []
  const request: ExplainRequest = { target: '', depth: 'standard', lens: 'flow', reader: 'familiar' }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''

    if (!token.startsWith('--')) {
      words.push(token)
      continue
    }

    const [flag = '', inline] = token.slice(2).split(/=(.*)/s, 2)
    const value = inline ?? tokens[++index]

    if (value === undefined) {
      return { error: `--${flag} needs a value.` }
    }

    if (flag === 'goal') {
      request.goal = value
    } else if (flag === 'depth' && isOneOf(DEPTHS, value)) {
      request.depth = value
    } else if (flag === 'lens' && isOneOf(LENSES, value)) {
      request.lens = value
    } else if (flag === 'reader' && isOneOf(READERS, value)) {
      request.reader = value
    } else {
      return { error: `Unknown flag or value: --${flag} ${value}. ${USAGE}` }
    }
  }

  request.target = words.join(' ')

  return { request }
}

export const USAGE =
  'Usage: /explain [target] [--goal "..."] [--depth brief|standard|deep] [--lens flow|domain] [--reader new|familiar]'

// Splits on whitespace, keeping "double" or 'single' quoted runs whole.
export function tokenize(args: string): string[] {
  const tokens: string[] = []
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g

  for (const match of args.matchAll(pattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '')
  }

  return tokens
}

export type TargetClass = TourTargetKind | 'last' | 'probe'

// What can be told from the words alone; 'probe' means the command must ask
// the disk (a path) and then git (a branch), falling back to a question.
export function classifyTarget(target: string): TargetClass {
  const trimmed = target.trim()

  if (trimmed === '') return 'worktree'
  if (trimmed === 'last') return 'last'
  if (/^#\d+$/.test(trimmed) || /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(trimmed)) return 'pr'
  if (/\s/.test(trimmed) || trimmed.endsWith('?')) return 'question'
  if (/^[^\s.][^\s]*\.\.\.?[^\s]+$/.test(trimmed) && !/\.\.\//.test(trimmed)) return 'range'

  return 'probe'
}

// `src/auth/session.ts:createSession` names a path and a symbol in it.
export function splitPathSymbol(target: string): { path: string; symbol?: string } {
  const match = /^(.+?):([A-Za-z_$][\w$.]*)$/.exec(target)

  return match ? { path: match[1] ?? target, symbol: match[2] } : { path: target }
}

// The git command whose output shows a target's change for one file, or
// null when the target is existing code with no diff.
export function diffArgv(target: TourTarget, file: string): string[] | null {
  const tail = ['--', file]

  if (target.baseSha && target.headSha) return ['git', 'diff', target.baseSha, target.headSha, ...tail]

  switch (target.kind) {
    case 'worktree':
      return ['git', 'diff', 'HEAD', ...tail]
    case 'range':
      return ['git', 'diff', target.ref, ...tail]
    case 'branch':
      return ['git', 'diff', `${target.baseSha ?? 'HEAD'}...${target.ref}`, ...tail]
    case 'pr':
      return target.baseSha ? ['git', 'diff', target.baseSha, ...tail] : null
    default:
      return null
  }
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
}
