import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Tour, TourTarget } from '../src/core/model/tour.ts'
import { getTour, removeTour, upsertTour } from '../src/core/services/tour-machine.ts'
import { loadCode } from './code-view.ts'
import { FOLLOW_KEY, isFollowOn } from './follow.ts'
import { USAGE, classifyTarget, parseExplainArgs, splitPathSymbol } from './explain-args.ts'
import { openPane } from './pane/open.ts'
import { authoringPrompt } from './prompts.ts'
import { EMPTY_DOCUMENT, PINNED_KEY } from './state.ts'
import { pinnedTours } from './tools.ts'

const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)

// `/explain [target] [flags]` resolves the target, opens the pane in its
// drafting state and hands Claude the authoring prompt. `/tour` reopens,
// pins, lists and drops tours.

export async function registerCommands($: EngineInterface): Promise<void> {
  await $.command.register({
    name: 'explain',
    description: 'Explain your changes, a commit range, a branch, a PR, a path, or a question about the code as a tour in a pane',
    argumentHint: '[target] [--goal "..."] [--depth brief|standard|deep] [--lens flow|domain] [--reader new|familiar]',
  })
  await $.command.register({
    name: 'tour',
    description: 'Open the Faro tour pane, or pin, list and drop tours',
    argumentHint: '[open [id] | pin [name] | list | drop <id> | follow on|off]',
  })
}

export function serveCommands(on: On): void {
  on('command.run', { command: 'explain' }, async ($, e) => {
    const parsed = parseExplainArgs(e.args)

    if ('error' in parsed) {
      return { text: parsed.error }
    }

    const { request } = parsed

    if (classifyTarget(request.target) === 'last') {
      return { text: await reopen($) }
    }

    const resolved = await resolveTarget($, request.target)

    if ('empty' in resolved) {
      return { text: resolved.empty }
    }

    await update($, draftingAtom, () => ({ label: resolved.label, detail: resolved.detail }))
    await openPane($)
    const text = authoringPrompt(request, resolved.target, `${$.plugin.root}/skills/faro-author-paths`, resolved.notes)

    // A command cannot submit while it holds the turn, so the prompt goes
    // out from a timer once the command has answered.
    $.clock.after(0, () => $.prompt.submit({ text }))

    return { text: `Drafting a tour of ${resolved.label}. It opens in the Faro pane.` }
  })

  on('command.run', { command: 'tour' }, async ($, e) => {
    const [verb = 'open', ...rest] = e.args.trim().split(/\s+/).filter(Boolean)
    const name = rest.join('-') || undefined

    switch (verb) {
      case 'open':
        return { text: await reopen($, name) }
      case 'pin':
        return { text: await pin($, name) }
      case 'list':
        return { text: await list($) }
      case 'drop':
        return { text: name ? await drop($, name) : 'Usage: /tour drop <id>' }
      case 'follow':
        return { text: await follow($, name) }
      default:
        return { text: USAGE_TOUR }
    }
  })
}

const USAGE_TOUR = 'Usage: /tour [open [id] | pin [name] | list | drop <id> | follow on|off]'

async function follow($: EngineInterface, setting?: string): Promise<string> {
  if (setting === 'on' || setting === 'off') {
    await $.store.set(FOLLOW_KEY, setting === 'on')
  } else if (setting !== undefined) {
    return USAGE_TOUR
  }

  return (await isFollowOn($))
    ? 'VS Code follows the tour: the Faro extension opens and highlights each step. /tour follow off stops it.'
    : 'VS Code does not follow the tour. /tour follow on starts it.'
}

type Resolved =
  | { target: TourTarget; label: string; detail: string; notes: string[] }
  | { empty: string }

async function resolveTarget($: EngineInterface, text: string): Promise<Resolved> {
  const kind = classifyTarget(text)

  if (kind === 'worktree') {
    const status = await git($, ['status', '--porcelain'])
    const files = lines(status)

    return files.length === 0
      ? { empty: 'No changes to explain. Name a target instead. ' + USAGE }
      : {
          target: { kind: 'worktree', ref: 'HEAD' },
          label: 'your uncommitted changes',
          detail: `${files.length} changed file${files.length === 1 ? '' : 's'}`,
          notes: ['Read the change with `git diff HEAD` and `git status` (untracked files count too).'],
        }
  }

  if (kind === 'range') {
    const files = lines(await git($, ['diff', '--name-only', text]))

    return files.length === 0
      ? { empty: `No changes in ${text}.` }
      : {
          target: { kind: 'range', ref: text },
          label: text,
          detail: `${files.length} changed file${files.length === 1 ? '' : 's'}`,
          notes: [`Read the change with \`git diff ${text}\` and the stated intent with \`git log ${text}\`.`],
        }
  }

  if (kind === 'pr') {
    return {
      target: { kind: 'pr', ref: text },
      label: `pull request ${text}`,
      detail: 'reading it with gh',
      notes: [
        `Read it with \`gh pr view ${text}\` (its description is the stated intent) and \`gh pr diff ${text}\`.`,
        `Set target.baseSha and target.headSha from \`gh pr view ${text} --json baseRefOid,headRefOid\` when gh can answer.`,
      ],
    }
  }

  if (kind === 'question') {
    return questionTarget(text)
  }

  const { path, symbol } = splitPathSymbol(text)

  if (await exists($, path)) {
    return {
      target: { kind: 'code', ref: text },
      label: text,
      detail: symbol ? `${symbol} in ${path}` : `existing code under ${path}`,
      notes: ['This is existing code with no diff: anchors carry ranges and no hunks, and most reasons will be inferred.'],
    }
  }

  const head = (await git($, ['rev-parse', '--verify', '--quiet', `${text}^{commit}`])).trim()

  if (head) {
    const base = await defaultBranch($)
    const mergeBase = (await git($, ['merge-base', base, text])).trim()
    const files = mergeBase ? lines(await git($, ['diff', '--name-only', mergeBase, head])) : []

    if (mergeBase && files.length === 0) {
      return { empty: `${text} has no changes against ${base}.` }
    }

    return {
      target: { kind: 'branch', ref: text, ...(mergeBase ? { baseSha: mergeBase } : {}), headSha: head },
      label: `branch ${text}`,
      detail: mergeBase ? `${files.length} changed files against ${base}` : `no merge base with ${base}`,
      notes: [
        mergeBase
          ? `Read the change with \`git diff ${mergeBase} ${head}\` and the intent with \`git log ${mergeBase}..${head}\`.`
          : `Find a base for ${text} yourself; git found no merge base with ${base}.`,
      ],
    }
  }

  // A bare word that is neither a path nor a git ref is read as a question.
  return questionTarget(text)
}

function questionTarget(text: string): Resolved {
  return {
    target: { kind: 'question', ref: text },
    label: `“${text}”`,
    detail: 'finding the entry point and tracing the flow',
    notes: ['This is existing code with no diff: anchors carry ranges and no hunks, and most reasons will be inferred.'],
  }
}

async function reopen($: EngineInterface, id?: string): Promise<string> {
  const document = await read($, documentAtom)
  const live = getTour(document, id)

  if (live) {
    await update($, documentAtom, (current) => ({ ...current, activeTourId: live.id }))
    await loadCode($, live)
    await openPane($)
    return `Showing tour ${live.id}.`
  }

  const pinned = await pinnedTours($)
  const kept = id ? pinned[id] : Object.values(pinned).at(-1)

  if (!kept) {
    await openPane($)
    return id ? `No tour ${id}. /tour list shows the tours you have.` : 'No tour yet. Run /explain to start.'
  }

  await update($, documentAtom, (current) => upsertTour(current, kept))
  await loadCode($, kept)
  await openPane($)

  return `Showing pinned tour ${kept.id}.`
}

async function pin($: EngineInterface, name?: string): Promise<string> {
  const tour = getTour(await read($, documentAtom))

  if (!tour) {
    return 'No tour is open to pin.'
  }

  const id = name ?? tour.id
  const pinned = await pinnedTours($)
  const kept: Tour = { ...tour, id }
  await $.store.set(PINNED_KEY, { ...pinned, [id]: kept })

  return `Pinned ${tour.title} as ${id}. It stays across sessions; /tour open ${id} brings it back.`
}

async function list($: EngineInterface): Promise<string> {
  const document = await read($, documentAtom)
  const pinned = await pinnedTours($)
  const rows = [
    ...document.tours.map((tour) => `${tour.id === document.activeTourId ? '▸' : ' '} ${tour.id}  ${tour.title}`),
    ...Object.values(pinned).map((tour) => `  ${tour.id}  ${tour.title}  (pinned)`),
  ]

  return rows.length > 0 ? rows.join('\n') : 'No tours yet. Run /explain to start.'
}

async function drop($: EngineInterface, id: string): Promise<string> {
  const pinned = await pinnedTours($)
  const document = await read($, documentAtom)
  const wasLive = document.tours.some((tour) => tour.id === id)

  if (!pinned[id] && !wasLive) {
    return `No tour ${id}.`
  }

  const { [id]: _dropped, ...rest } = pinned
  await $.store.set(PINNED_KEY, rest)
  await update($, documentAtom, (current) => removeTour(current, id))

  return `Dropped ${id}.`
}

async function git($: EngineInterface, args: string[]): Promise<string> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', ...args])
    return exitCode === 0 ? stdout : ''
  } catch {
    return ''
  }
}

async function defaultBranch($: EngineInterface): Promise<string> {
  const remoteHead = (await git($, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).trim()

  if (remoteHead) return remoteHead

  return (await git($, ['rev-parse', '--verify', '--quiet', 'main'])).trim() ? 'main' : 'master'
}

async function exists($: EngineInterface, path: string): Promise<boolean> {
  try {
    await $.fs.stat(path)
    return true
  } catch {
    return false
  }
}

function lines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim().length > 0)
}
