import { atom, read } from 'claude-code'
import type { Elements, On, RenderChildren } from 'claude-code'

import type { Tour, TourNode, TourWhy } from '../../src/core/model/tour.ts'
import { getTour, pathPosition } from '../../src/core/services/tour-machine.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from '../state.ts'
import type { FaroCodeView as CodeView, FaroReader as ReaderState } from '../types'
import { runAction, selectNode } from './actions.ts'
import { PANE_KEYS } from './keys.ts'
import { LOGO_ROWS, LOGO_WIDTH, WORDMARK_ROWS, logoSegments } from './logo.ts'
import { fileTree, type TreeFile } from '../file-tree.ts'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// The Path view: header and hypothesis, the reading path as a numbered
// spine, the current node at its depth, and the code under it.

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
          {brand(ui, width)}
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
          {brand(ui, width)}
          <Text>No tour yet.</Text>
          <Text dimColor>Run /explain to explain your changes, or /explain "how does X work?" for existing code.</Text>
        </Box>
      )
    }

    const reader = await read($, readerAtom)
    const code = await read($, codeAtom)
    const node = tour.current.nodeId ? tour.nodes[tour.current.nodeId] : undefined
    const { index, total } = pathPosition(tour)
    const supporting = Object.values(tour.nodes).filter((entry) => !tour.path.includes(entry.id))
    const stale = reader.stale[tour.id] ?? []
    const keys = PANE_KEYS.filter((key) => key.action !== 'refresh' || (node && stale.includes(node.id)))

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          {width >= 60 && logo(ui)}
          <Box flexDirection="column" flexShrink={1}>
            {width >= 60 && wordmark(ui)}
            <Text wrap="truncate-end">
              <Text bold>{tour.title}</Text>
              <Text dimColor>
                {'  '}
                {tour.lens} lens · {index + 1} of {total}
              </Text>
            </Text>
            <Text>
              <Text dimColor>Hypothesis: </Text>
              {tour.hypothesis}
            </Text>
          </Box>
        </Box>
        <Text dimColor>{rule}</Text>
        {tour.path.map((id, position) => {
          const entry = tour.nodes[id]

          return entry ? (
            <Button key={`node-${id}`} plain onPress={() => selectNode($, id)}>
              {pathRow(entry, position, tour, reader, width)}
            </Button>
          ) : null
        })}
        {supporting.length > 0 && (
          <Text dimColor wrap="truncate-end">
            {'   '}also: {supporting.map((entry) => entry.title).join(' · ')}
          </Text>
        )}
        {!reader.isFileTreeHidden && (
          <Box flexDirection="column">
            <Text dimColor>{rule}</Text>
            {fileTree(treeFiles(tour, reader)).map((row) => (
              <Text bold={row.isCurrent} dimColor={row.isDim} wrap="truncate-end">
                {row.text}
              </Text>
            ))}
          </Box>
        )}
        <Text dimColor>{rule}</Text>
        {node && nodePanel(ui, tour, node, reader, stale.includes(node.id))}
        {node && code && code.nodeId === node.id && codePanel(ui, code)}
        <Text dimColor>{rule}</Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {keys.map((key) => (
            <Button key={`key-${key.action}`} plain hotkey={key.hotkey} label={key.label} onPress={() => runAction($, key.action)} />
          ))}
        </Box>
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
    </Box>
  )
}

function wordmark({ Box, Text }: Ui) {
  return (
    <Box flexDirection="column" flexShrink={0}>
      {WORDMARK_ROWS.map((row) => (
        <Text bold>{row}</Text>
      ))}
    </Box>
  )
}

// The mark and the name side by side, for the screens with room to spare;
// the name alone when the pane is too narrow for both.
function brand(ui: Ui, width: number) {
  const { Box } = ui

  if (width < LOGO_WIDTH + 2 + WORDMARK_ROWS[0]!.length) {
    return wordmark(ui)
  }

  return (
    <Box flexDirection="row" columnGap={2} alignItems="center">
      {logo(ui)}
      {wordmark(ui)}
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

function nodePanel({ Text }: Ui, tour: Tour, node: TourNode, reader: ReaderState, isStale: boolean): RenderChildren[] {
  const depth = tour.current.depth
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
      {node.title}
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

function codePanel({ Text, Code }: Ui, code: CodeView): RenderChildren[] {
  return [
    <Text dimColor>
      {code.heading}
      {code.isFull ? '   (o narrows to the beacon)' : '   (o shows the whole range)'}
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
