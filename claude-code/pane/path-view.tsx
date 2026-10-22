import { atom, read } from 'claude-code'
import type { Elements, On, RenderChildren } from 'claude-code'

import type { Tour, TourNode, TourWhy } from '../../src/core/model/tour.ts'
import { getTour, pathPosition } from '../../src/core/services/tour-machine.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from '../state.ts'
import type { FaroCodeView as CodeView, FaroReader as ReaderState } from '../types'
import { runAction, selectNode } from './actions.ts'
import { PANE_KEYS } from './keys.ts'
import { LOGO_ROWS, LOGO_WIDTH, WORDMARK, logoSegments } from './logo.ts'
import { fileTree, type TreeFile } from '../file-tree.ts'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)
const pairedAtom = atom({ plugin: 'faro', key: 'paired' } as const, false)

// Below this many rows (VS Code's integrated terminal, typically) the pane
// drops the step list and tree for a one-line breadcrumb.
const SHORT_ROWS = 18
// From this width the file tree sits beside the step list instead of below.
const SIDE_TREE_COLUMNS = 90

// The Path view: header and hypothesis, the reading path as a numbered
// spine beside the file tree, the current node at its depth, and the code
// under it. While VS Code follows ("paired") the code is there, so the code
// panel folds to one line and the node shows at least L1.

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
    const pairing = isPaired ? ' · ⇄ VS Code' : ''
    const keys = PANE_KEYS.filter(
      (key) =>
        (key.action !== 'refresh' || (node && stale.includes(node.id))) &&
        (key.action !== 'files' || !isShort) &&
        (key.action !== 'steps' || isShort),
    )
    const pathRows = (rowWidth: number) =>
      tour.path.map((id, position) => {
        const entry = tour.nodes[id]

        return entry ? (
          <Button key={`node-${id}`} plain onPress={() => selectNode($, id)}>
            {pathRow(entry, position, tour, reader, rowWidth)}
          </Button>
        ) : null
      })
    const treeRows = (rowWidth: number, prefix: string) =>
      fileTree(treeFiles(tour, reader)).map((row) => (
        <Text bold={row.isCurrent} dimColor={row.isDim} wrap="truncate-end">
          {`${prefix}${row.text}`.slice(0, rowWidth)}
        </Text>
      ))
    const story = node && (
      <Box flexDirection="column">
        {nodePanel(ui, tour, node, reader, depth, stale.includes(node.id), !isShort)}
        {code && code.nodeId === node.id && (isCodeFolded ? foldedCode(ui, node, reader, code, isPaired, width) : codePanel(ui, code))}
      </Box>
    )
    const footer = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {keys.map((key) => (
          <Button key={`key-${key.action}`} plain hotkey={key.hotkey} label={key.label} onPress={() => runAction($, key.action)} />
        ))}
      </Box>
    )

    if (isShort) {
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end">
            <Text bold>
              faro {index + 1}/{total} {progressMarks(tour, reader)}
            </Text>
            {'  '}
            {node?.title ?? tour.title}
            <Text dimColor>
              {'  '}
              {tour.lens}
              {pairing}
            </Text>
          </Text>
          {reader.isStepListShown && pathRows(width)}
          {story}
          {footer}
        </Box>
      )
    }

    const isTreeShown = !reader.isFileTreeHidden
    const isTreeBeside = isTreeShown && width >= SIDE_TREE_COLUMNS
    const treeWidth = Math.min(32, Math.floor(width * 0.3))
    const listWidth = isTreeBeside ? width - treeWidth - 1 : width

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          {width >= 60 && logo(ui)}
          <Box flexDirection="column" flexShrink={1}>
            <Text wrap="truncate-end">
              <Text bold>{tour.title}</Text>
              <Text dimColor>
                {'  '}
                {tour.lens} lens · {index + 1} of {total}
                {pairing}
              </Text>
            </Text>
            <Text>
              <Text dimColor>Hypothesis: </Text>
              {tour.hypothesis}
            </Text>
          </Box>
        </Box>
        <Text dimColor>{rule}</Text>
        <Box flexDirection="row">
          <Box flexDirection="column" width={listWidth} flexShrink={0}>
            {pathRows(listWidth)}
            {supporting.length > 0 && (
              <Text dimColor wrap="truncate-end">
                {'   '}also: {supporting.map((entry) => entry.title).join(' · ')}
              </Text>
            )}
          </Box>
          {isTreeBeside && <Box flexDirection="column">{treeRows(treeWidth + 1, '│ ')}</Box>}
        </Box>
        {isTreeShown && !isTreeBeside && (
          <Box flexDirection="column">
            <Text dimColor>{rule}</Text>
            {treeRows(width, '')}
          </Box>
        )}
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

function pathRow(node: TourNode, position: number, tour: Tour, reader: ReaderState, width: number): string {
  const isCurrent = tour.current.nodeId === node.id
  const isVisited = (reader.visited[tour.id] ?? []).includes(node.id)
  const isStale = (reader.stale[tour.id] ?? []).includes(node.id)
  const mark = isCurrent ? '▸' : isVisited ? '✓' : ' '
  const flags = `${node.surprise ? ' !' : ''}${isStale ? ' ~' : ''}`
  const file = node.anchors[0]?.file.split('/').slice(-2).join('/') ?? ''
  const row = `${mark} ${String(position + 1).padStart(2)}  ${node.title}   ${node.plan}   ${file}${flags}`

  return row.length > width ? `${row.slice(0, width - 1)}…` : row
}

type Ui = Elements[keyof Elements]

function nodePanel(
  { Text }: Ui,
  tour: Tour,
  node: TourNode,
  reader: ReaderState,
  depth: number,
  isStale: boolean,
  isTitleShown: boolean,
): RenderChildren[] {
  const otherLens = tour.lens === 'flow' ? 'domain' : 'flow'
  const lensText = reader.isOtherLensShown ? node.otherLens : node
  const lines: RenderChildren[] = []
  const add = (label: string, value: string | undefined) => {
    if (value) {
      lines.push(
        <Text>
          <Text dimColor>{label}: </Text>
          {value}
        </Text>,
      )
    }
  }

  lines.push(
    <Text bold>
      {isTitleShown ? node.title : `${tour.path.indexOf(node.id) + 1}`}
      <Text dimColor>
        {'  '}plan: {node.plan || '—'}
        {reader.isOtherLensShown ? `  · ${otherLens} lens` : ''}
      </Text>
    </Text>,
  )

  if (reader.isOtherLensShown && !node.otherLens) {
    lines.push(<Text dimColor>Writing the {otherLens} lens for this step…</Text>)
    return lines
  }

  lines.push(<Text>{lensText?.summary ?? node.summary}</Text>)

  if (isStale) {
    lines.push(<Text color="warning">~ The code under this step changed since the tour was written. Press r to refresh it.</Text>)
  }

  if (node.surprise) {
    add('! Surprise', node.surprise)
  }

  if (depth >= 1) {
    add('Confirms', node.confirms)
    add('What changed', lensText?.whatChanged)
    add('What it does', lensText?.whatItDoes)
    add('Why', whyText(lensText?.why))
    add('Beacons', node.beacons.map((beacon) => `${beacon.label} (L${beacon.line})`).join(' · '))
    add('Carry forward', node.carryForward)
  }

  if (depth >= 2) {
    add('Detail', node.detail)
    add('Ask next', node.suggestedQuestion)
  }

  if (depth < 2) {
    lines.push(<Text dimColor>Press e for more ({depth === 0 ? 'why, beacons, carry forward' : 'detail, next question'}).</Text>)
  }

  return lines
}

// The code panel folded to one line: where the code is, and how to open it.
function foldedCode({ Text }: Ui, node: TourNode, reader: ReaderState, code: CodeView, isPaired: boolean, width: number) {
  const count = node.beacons.length
  const beacon = count > 0 ? node.beacons[reader.beaconIndex % count] : undefined
  const where = isPaired && beacon ? `code in VS Code: ${beacon.file} L${beacon.line}` : code.heading
  const which = count > 1 ? ` · beacon ${(reader.beaconIndex % count) + 1} of ${count}` : ''
  const text = `─ ${where}${which} `
  const hint = ' c show ─'

  return (
    <Text dimColor wrap="truncate-end">
      {text}
      {'─'.repeat(Math.max(1, width - text.length - hint.length))}
      {hint}
    </Text>
  )
}

function progressMarks(tour: Tour, reader: ReaderState): string {
  const visited = reader.visited[tour.id] ?? []

  return tour.path.map((id) => (id === tour.current.nodeId ? '▸' : visited.includes(id) ? '✓' : '○')).join('')
}

function codePanel({ Text, Code }: Ui, code: CodeView): RenderChildren[] {
  return [
    <Text dimColor>
      {code.heading}
      {code.isFull ? '   (o narrows to the beacon, c folds)' : '   (o shows the whole range, c folds)'}
    </Text>,
    <Code
      source={code.source}
      format={code.format}
      startLine={code.format === 'source' ? code.startLine : undefined}
      path={code.path}
      wrap="truncate-end"
    />,
  ]
}

function whyText(why: TourWhy | undefined): string | undefined {
  if (!why) return undefined

  return why.source === 'inferred' ? `${why.text} (inferred)` : `${why.text} (from the ${why.source})`
}
