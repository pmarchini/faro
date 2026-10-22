import { atom, read } from 'claude-code'
import type { Elements, On, RenderChildren } from 'claude-code'

import type { Tour, TourNode, TourWhy } from '../../src/core/model/tour.ts'
import { getTour, pathPosition } from '../../src/core/services/tour-machine.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from '../state.ts'
import type { FaroCodeView as CodeView, FaroReader as ReaderState } from '../types'
import { runAction, selectNode } from './actions.ts'
import { PANE_KEYS } from './keys.ts'
import { LOGO_ROWS, LOGO_WIDTH, WORDMARK, logoSegments } from './logo.ts'
import { compactFiles, type TreeFile } from '../file-tree.ts'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)
const pairedAtom = atom({ plugin: 'faro', key: 'paired' } as const, false)

// Below this many rows (VS Code's integrated terminal, typically) the pane
// drops the step and file lists for a one-line breadcrumb.
const SHORT_ROWS = 18
// The width of a story field's label, so its text wraps under itself.
const FIELD_WIDTH = 11

// The Path view, laid out for a column of about 80 cells beside the chat:
// header, steps, files (`f`), the current step's story, its code, keys.
// While VS Code follows ("paired") the code is there, so the code panel
// folds to one line and the story shows at least L1.

export function drawPathView(on: On): void {
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const document = await read($, documentAtom)
    const drafting = await read($, draftingAtom)
    const tour = getTour(document)
    const width = Math.max(20, e.props.bodyColumns)
    const rule = '─'.repeat(width)

    if (drafting) {
      return (
        <Box flexDirection="column">
          {logo(ui)}
          <Text bold>Drafting a tour</Text>
          <Text>{drafting.label}</Text>
          <Text dimColor>{drafting.detail}</Text>
          <Text dimColor>The path appears here as soon as Claude writes it.</Text>
        </Box>
      )
    }

    if (!tour) {
      return (
        <Box flexDirection="column">
          {logo(ui)}
          <Text>No tour yet.</Text>
          <Text dimColor>Run /explain to explain your changes, or /explain "how does X work?" for existing code.</Text>
        </Box>
      )
    }

    const reader = await read($, readerAtom)
    const code = await read($, codeAtom)
    const isPaired = await read($, pairedAtom)
    const isShort = e.props.scroll.bodyRows < SHORT_ROWS
    const node = tour.current.nodeId ? tour.nodes[tour.current.nodeId] : undefined
    const { index, total } = pathPosition(tour)
    const supporting = Object.values(tour.nodes).filter((entry) => !tour.path.includes(entry.id))
    const stale = reader.stale[tour.id] ?? []
    const isCodeFolded = isPaired || isShort ? !reader.isCodeToggled : reader.isCodeToggled
    const depth = isPaired ? Math.max(tour.current.depth, 1) : tour.current.depth
    const keys = PANE_KEYS.filter(
      (key) =>
        (key.action !== 'refresh' || (node && stale.includes(node.id))) &&
        (key.action !== 'files' || !isShort) &&
        (key.action !== 'steps' || isShort),
    )
    const steps = tour.path.map((id, position) => {
      const entry = tour.nodes[id]

      return entry ? (
        <Button key={`node-${id}`} plain onPress={() => selectNode($, id)}>
          {stepRow(entry, position, tour, reader, width)}
        </Button>
      ) : null
    })
    const story = node && (
      <Box flexDirection="column">
        {nodePanel(ui, tour, node, reader, depth, stale.includes(node.id), width)}
        {code &&
          code.nodeId === node.id &&
          (isCodeFolded ? foldedCode(ui, node, reader, code, isPaired) : codePanel(ui, node, reader, code))}
      </Box>
    )
    const footer = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {keys.map((key) => (
          <Button key={`key-${key.action}`} plain hotkey={key.hotkey} label={key.label} onPress={() => runAction($, key.action)} />
        ))}
      </Box>
    )
    const status = (
      <Text dimColor>
        {'  '}
        {isCodeTour(tour) ? 'code tour · ' : ''}
        {tour.lens}
        {'  '}
      </Text>
    )

    if (isShort) {
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end">
            <Text bold color="suggestion">
              faro
            </Text>{' '}
            {index + 1}/{total} {progressMarks(tour, reader)}
            {status}
            {isPaired ? '⇄ VS Code' : ''}
          </Text>
          {reader.isStepListShown && steps}
          {story}
          {footer}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text bold color="suggestion">
            faro
          </Text>
          {'  '}
          <Text bold>{tour.title}</Text>
          {status}
          {index + 1}/{total}
          {isPaired ? '  ⇄ VS Code' : ''}
        </Text>
        <Text dimColor wrap="truncate-end">
          {tour.hypothesis}
        </Text>
        <Text dimColor>{rule}</Text>
        <Text dimColor>STEPS</Text>
        {steps}
        {supporting.length > 0 && (
          <Text dimColor wrap="truncate-end">
            {'     '}also: {supporting.map((entry) => entry.title).join(' · ')}
          </Text>
        )}
        <Text dimColor>{reader.isFileTreeHidden ? 'FILES  (f shows)' : 'FILES  (f hides)'}</Text>
        {!reader.isFileTreeHidden &&
          compactFiles(treeFiles(tour, reader)).map((row) => (
            <Text bold={row.isCurrent} dimColor={row.isDim} wrap="truncate-end">
              {row.text}
            </Text>
          ))}
        <Text dimColor>{rule}</Text>
        {story}
        <Text dimColor>{rule}</Text>
        {footer}
      </Box>
    )
  })
}

function logo({ Box, Text }: Ui) {
  return (
    <Box flexDirection="column" flexShrink={0} width={LOGO_WIDTH}>
      {LOGO_ROWS.map((row) => (
        <Text>
          {logoSegments(row).map((segment) =>
            segment.isLight ? <Text bold>{segment.text}</Text> : <Text color="suggestion">{segment.text}</Text>,
          )}
        </Text>
      ))}
      <Text bold>{WORDMARK}</Text>
    </Box>
  )
}

// Each file the tour anchors in, with the path steps that read it.
function treeFiles(tour: Tour, reader: ReaderState): TreeFile[] {
  const files = new Map<string, TreeFile>()
  const visited = reader.visited[tour.id] ?? []
  const current = tour.current.nodeId

  for (const node of Object.values(tour.nodes)) {
    const step = tour.path.indexOf(node.id) + 1

    for (const { file } of node.anchors) {
      const entry = files.get(file) ?? { file, steps: [], isCurrent: false, isVisited: false }

      if (step > 0 && !entry.steps.includes(step)) entry.steps.push(step)
      entry.isCurrent ||= node.id === current
      entry.isVisited ||= visited.includes(node.id)
      files.set(file, entry)
    }
  }

  return [...files.values()].map((entry) => ({ ...entry, steps: entry.steps.sort((a, b) => a - b) }))
}

// One step: mark, number, title cut with an ellipsis to leave room for the
// flags and the file, which stay whole.
function stepRow(node: TourNode, position: number, tour: Tour, reader: ReaderState, width: number): string {
  const isCurrent = tour.current.nodeId === node.id
  const isVisited = (reader.visited[tour.id] ?? []).includes(node.id)
  const isStale = (reader.stale[tour.id] ?? []).includes(node.id)
  const mark = isCurrent ? '▸' : isVisited ? '✓' : ' '
  const flags = `${node.surprise ? ' !' : ''}${isStale ? ' ~' : ''}`
  const file = node.anchors[0]?.file.split('/').slice(-2).join('/') ?? ''
  const head = `${mark} ${String(position + 1).padStart(2)}  `
  const tail = `${flags}  ${file}`
  const room = Math.max(8, width - head.length - tail.length)
  const title = node.title.length > room ? `${node.title.slice(0, room - 1)}…` : node.title.padEnd(room)

  return `${head}${title}${tail}`.slice(0, width)
}

type Ui = Elements[keyof Elements]

// The current step's story. The headline wraps with a hanging indent under
// its number, and each field's text wraps under itself, not its label.
function nodePanel(
  { Box, Text }: Ui,
  tour: Tour,
  node: TourNode,
  reader: ReaderState,
  depth: number,
  isStale: boolean,
  width: number,
): RenderChildren[] {
  const isCode = isCodeTour(tour)
  const otherLens = tour.lens === 'flow' ? 'domain' : 'flow'
  const lensText = reader.isOtherLensShown ? node.otherLens : node
  const number = `${tour.path.indexOf(node.id) + 1}`.padEnd(3)
  const chip = node.plan ? `[${isCode ? 'role: ' : ''}${node.plan}]` : ''
  const lines: RenderChildren[] = []
  const add = (label: string, value: string | undefined, color?: string) => {
    if (value) {
      lines.push(
        <Box flexDirection="row">
          <Box width={FIELD_WIDTH} flexShrink={0}>
            <Text dimColor>{label}</Text>
          </Box>
          <Box flexShrink={1}>
            <Text color={color}>{value}</Text>
          </Box>
        </Box>,
      )
    }
  }

  lines.push(
    <Box flexDirection="row">
      <Box width={number.length} flexShrink={0}>
        <Text bold color="suggestion">
          {number}
        </Text>
      </Box>
      <Box flexShrink={1} width={Math.max(10, width - number.length - chip.length - 1)}>
        <Text bold>{node.title}</Text>
      </Box>
      <Box flexShrink={0} marginLeft={1}>
        <Text dimColor>{chip}</Text>
      </Box>
    </Box>,
  )

  if (reader.isOtherLensShown) {
    lines.push(<Text dimColor>{`${otherLens} lens`}</Text>)
  }

  if (reader.isOtherLensShown && !node.otherLens) {
    lines.push(<Text dimColor>Writing the {otherLens} lens for this step…</Text>)
    return lines
  }

  if (isStale) {
    lines.push(<Text color="warning">~ The code under this step changed since the tour was written. Press r to refresh it.</Text>)
  }

  if (depth === 0) {
    lines.push(
      <Box marginLeft={number.length}>
        <Text>{lensText?.summary ?? node.summary}</Text>
      </Box>,
    )
  }

  if (node.surprise) {
    add('! Surprise', node.surprise, 'warning')
  }

  if (depth >= 1) {
    add('Confirms', node.confirms)
    add(isCode ? 'Does' : 'What', lensText?.whatChanged ?? lensText?.whatItDoes)
    add('Why', whyText(lensText?.why, isCode))
    add(isCode ? 'Carry on' : 'Carry', node.carryForward, 'suggestion')
  }

  if (depth >= 2) {
    add('Beacons', node.beacons.map((beacon) => `${beacon.label} (L${beacon.line})`).join(' · '))
    add('Detail', node.detail)
    add('Ask next', node.suggestedQuestion)
  }

  if (depth < 2) {
    lines.push(<Text dimColor>Press e for more ({depth === 0 ? 'what, why, carry' : 'beacons, detail, next question'}).</Text>)
  }

  return lines
}

// The code panel folded to one line: where the code is, and how to open it.
function foldedCode({ Text }: Ui, node: TourNode, reader: ReaderState, code: CodeView, isPaired: boolean) {
  const count = node.beacons.length
  const beacon = count > 0 ? node.beacons[reader.beaconIndex % count] : undefined
  const which = count > 1 ? ` · beacon ${(reader.beaconIndex % count) + 1} of ${count}` : ''

  return isPaired && beacon ? (
    <Text wrap="truncate-end">
      <Text color="suggestion">⇄ </Text>Code in VS Code
      <Text dimColor>
        {'  '}
        {beacon.file} L{beacon.line}
        {which}
        {'   '}c shows here
      </Text>
    </Text>
  ) : (
    <Text dimColor wrap="truncate-end">
      {code.heading}
      {which}
      {'   '}c shows the code
    </Text>
  )
}

function progressMarks(tour: Tour, reader: ReaderState): string {
  const visited = reader.visited[tour.id] ?? []

  return tour.path.map((id) => (id === tour.current.nodeId ? '▸' : visited.includes(id) ? '✓' : '○')).join('')
}

// The code, then the step's beacons in this file: the Code element cannot
// tint lines, so each beacon is named under it, the current one marked.
function codePanel({ Text, Code }: Ui, node: TourNode, reader: ReaderState, code: CodeView): RenderChildren[] {
  const count = node.beacons.length
  const beacons = node.beacons
    .map((beacon, index) => ({ ...beacon, index, isCurrent: count > 0 && index === reader.beaconIndex % count }))
    .filter((beacon) => beacon.file === code.path)

  return [
    <Text dimColor wrap="truncate-end">
      {code.heading}
      {code.isFull ? '   o narrows · c hides' : '   o widens · c hides'}
    </Text>,
    <Code
      source={code.source}
      format={code.format}
      startLine={code.format === 'source' ? code.startLine : undefined}
      path={code.path}
      wrap="truncate-end"
    />,
    ...beacons.map((beacon) => (
      <Text color={beacon.isCurrent ? 'suggestion' : undefined} dimColor={!beacon.isCurrent} wrap="truncate-end">
        {beacon.isCurrent ? '◀' : '◁'} beacon {beacon.index + 1}  L{beacon.line}  {beacon.label}
      </Text>
    )),
  ]
}

// A tour of existing code, with no change behind it: there is no "what
// changed", and no commit to give a reason, so the labels say so.
function isCodeTour(tour: Tour): boolean {
  return tour.target.kind === 'code' || tour.target.kind === 'question'
}

function whyText(why: TourWhy | undefined, isCode: boolean): string | undefined {
  if (!why) return undefined
  if (why.source !== 'inferred') return `${why.text} (from the ${why.source})`

  return isCode ? `${why.text} (inferred: no commit says so)` : `${why.text} (inferred)`
}
