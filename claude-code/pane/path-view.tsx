import { atom, read } from 'claude-code'
import type { Elements, On, RenderChildren } from 'claude-code'

import type { Tour, TourNode, TourWhy } from '../../src/core/model/tour.ts'
import { getTour, pathPosition } from '../../src/core/services/tour-machine.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from '../state.ts'
import type { FaroCodeView as CodeView, FaroReader as ReaderState } from '../types'
import { runAction, selectNode } from './actions.ts'
import { PANE_KEYS } from './keys.ts'

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
      {code.isFull ? '' : '   (o shows the whole range)'}
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
