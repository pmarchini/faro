import { atom, read } from 'claude-code'
import type { Elements, On, RenderChildren } from 'claude-code'

import type { Tour, TourNode, TourWhy } from '../../src/core/model/tour.ts'
import { getTour, pathPosition } from '../../src/core/services/tour-machine.ts'
import { codeWindow, foldRows, type VisualRow, type WindowBeacon } from '../code-window.ts'
import { compactFiles, railFiles, type TreeFile } from '../file-tree.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from '../state.ts'
import type { FaroCodeRow as CodeRow, FaroCodeView as CodeView, FaroReader as ReaderState } from '../types'
import { runAction, selectNode } from './actions.ts'
import { PANE_KEYS } from './keys.ts'
import { LOGO_ROWS, LOGO_WIDTH, WORDMARK, logoSegments } from './logo.ts'
import {
  ACCENT,
  ACCENT_SOFT,
  ADDED,
  BEACON_ROW,
  BORDER,
  CHIP,
  CURRENT_STEP_ROW,
  CURRENT_BEACON_ROW,
  FOLD_ROW,
  MARK,
  MARK_LIGHT,
  RAIL,
  REMOVED,
} from './theme.ts'

const codeAtom = atom({ plugin: 'faro', key: 'code' } as const, null)
const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const draftingAtom = atom({ plugin: 'faro', key: 'drafting' } as const, null)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// Below this many rows (VS Code's integrated terminal, typically) the pane
// drops the rail for a one-line breadcrumb.
const SHORT_ROWS = 18
// The rail of steps and files beside the reader, from this pane width.
const RAIL_COLUMNS = 30
const RAIL_FROM_COLUMNS = 90
// The width of a story field's label, so its text wraps under itself.
const FIELD_WIDTH = 11
// The code card's border and padding, in rows and columns.
const CARD_ROWS = 2
const CARD_COLUMNS = 4
const MIN_CODE_ROWS = 6

type Ui = Elements[keyof Elements]
type Field = { label: string; text: string; color?: string }

// The Path view, a column beside the chat: a one-line header; a rail with
// the Faro mark, the steps and the tour's files (`f` hides it); and the
// reader, with the current step's story and its code filling the rest of
// the height, folded and windowed around the current beacon, the beacons
// listed under it.

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
    const rows = e.props.scroll.bodyRows
    const isShort = rows < SHORT_ROWS
    const isRail = !isShort && width >= RAIL_FROM_COLUMNS && !reader.isFileTreeHidden
    const readerWidth = isRail ? width - RAIL_COLUMNS - 1 : width
    const node = tour.current.nodeId ? tour.nodes[tour.current.nodeId] : undefined
    const { index, total } = pathPosition(tour)
    const stale = reader.stale[tour.id] ?? []
    const isCodeFolded = isShort ? !reader.isCodeToggled : reader.isCodeToggled
    const depth = tour.current.depth
    const keys = PANE_KEYS.filter(
      (key) =>
        (key.action !== 'refresh' || (node && stale.includes(node.id))) &&
        (key.action !== 'files' || !isShort) &&
        (key.action !== 'steps' || isShort) &&
        (!['fold', 'scrollDown', 'scrollUp'].includes(key.action) || !isCodeFolded),
    )
    const footer = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {keys.map((key) => (
          <Button key={`key-${key.action}`} plain hotkey={key.hotkey} label={key.label} onPress={() => runAction($, key.action)} />
        ))}
      </Box>
    )
    const fields = node ? storyFields(tour, node, reader, depth, stale.includes(node.id)) : []
    const story = node && storyPanel(ui, tour, node, reader, fields, readerWidth)
    const plainSteps = tour.path.map((id, position) => {
      const entry = tour.nodes[id]

      return entry ? (
        <Button key={`node-${id}`} plain onPress={() => selectNode($, id)}>
          {stepRow(entry, position, tour, reader, width)}
        </Button>
      ) : null
    })

    if (isShort) {
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end">
            {mark(ui)} {index + 1}/{total} {progressMarks(tour, reader)}
            <Text dimColor>
              {'  '}
              {isCodeTour(tour) ? 'code tour · ' : ''}
              {tour.lens}
            </Text>
          </Text>
          {reader.isStepListShown && plainSteps}
          {story}
          {node && code && code.nodeId === node.id && foldedCode(ui, node, reader, code)}
          {footer}
        </Box>
      )
    }

    // The rows the code may take: the pane's height less everything else.
    const stackedRows = isRail ? 0 : tour.path.length + 1 + (reader.isFileTreeHidden ? 1 : compactFiles(treeFiles(tour, reader)).length + 1)
    const beaconRows = node ? node.beacons.length + 1 : 0
    const footerRows = Math.ceil(keys.reduce((sum, key) => sum + key.label.length + 5, 0) / width)
    const codeRows = Math.max(
      MIN_CODE_ROWS,
      rows - 4 - stackedRows - storyRows(node, fields, readerWidth) - 1 - beaconRows - footerRows - CARD_ROWS,
    )
    const codeSection =
      node &&
      code &&
      code.nodeId === node.id &&
      (isCodeFolded ? foldedCode(ui, node, reader, code) : codePanel(ui, node, reader, code, codeRows, readerWidth))
    const header = (
      <Text wrap="truncate-end">
        {mark(ui)}
        {'  '}
        <Text bold>{tour.title}</Text>
        {isCodeTour(tour) ? '  ' : ''}
        <Text color="suggestion" backgroundColor={isCodeTour(tour) ? CHIP : undefined}>
          {isCodeTour(tour) ? ` code tour${tour.target.kind === 'code' && tour.target.ref ? ` · ${tour.target.ref}` : ''} ` : ''}
        </Text>
        <Text dimColor>
          {'  '}
          {tour.lens}
          {'  '}
        </Text>
        {index + 1}/{total}
      </Text>
    )

    if (!isRail) {
      return (
        <Box flexDirection="column">
          {header}
          <Text dimColor wrap="truncate-end">
            {tour.hypothesis}
          </Text>
          <Text dimColor>{rule}</Text>
          <Text dimColor>STEPS</Text>
          {plainSteps}
          <Text dimColor>{reader.isFileTreeHidden ? 'FILES  (h shows)' : 'FILES  (h hides)'}</Text>
          {!reader.isFileTreeHidden &&
            compactFiles(treeFiles(tour, reader)).map((row) => (
              <Text bold={row.isCurrent} dimColor={row.isDim} wrap="truncate-end">
                {row.text}
              </Text>
            ))}
          <Text dimColor>{rule}</Text>
          {story}
          {codeSection}
          <Text dimColor>{rule}</Text>
          {footer}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {header}
        <Text dimColor wrap="truncate-end">
          {tour.hypothesis}
        </Text>
        <Text dimColor>{rule}</Text>
        <Box flexDirection="row" columnGap={1}>
          <Box flexDirection="column" width={RAIL_COLUMNS} flexShrink={0} backgroundColor={RAIL}>
            <Box marginLeft={Math.floor((RAIL_COLUMNS - LOGO_WIDTH) / 2)}>{logo(ui)}</Box>
            <Text dimColor>STEPS</Text>
            {tour.path.map((id, position) => {
              const entry = tour.nodes[id]

              return entry ? railStep(ui, entry, position, tour, reader, () => selectNode($, id)) : null
            })}
            <Text dimColor> </Text>
            <Text dimColor>FILES  (h hides)</Text>
            {railFiles(treeFiles(tour, reader)).map((row) => (
              <Text bold={row.isCurrent} color={row.isCurrent ? ACCENT : undefined} dimColor={row.isDim} wrap="truncate-end">
                {row.text}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column" width={readerWidth} flexShrink={1}>
            {story}
            {codeSection}
          </Box>
        </Box>
        <Text dimColor>{rule}</Text>
        {footer}
      </Box>
    )
  })
}

// The Faro mark, from media/faro.svg, with the name under it.
function logo({ Box, Text }: Ui) {
  return (
    <Box flexDirection="column" flexShrink={0} width={LOGO_WIDTH}>
      {LOGO_ROWS.map((row) => (
        <Text>
          {logoSegments(row).map((segment) => (
            <Text bold={segment.isLight} color={segment.isLight ? MARK_LIGHT : MARK}>
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
      <Text bold color={MARK_LIGHT}>
        {WORDMARK}
      </Text>
    </Box>
  )
}

// The mark in one line, for the header: o-^-o faro.
function mark({ Text }: Ui) {
  return (
    <Text bold>
      <Text color={MARK}>o-</Text>
      <Text color={MARK_LIGHT}>^</Text>
      <Text color={MARK}>-o</Text>
      <Text color={MARK_LIGHT}> faro</Text>
    </Text>
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

function stepState(node: TourNode, tour: Tour, reader: ReaderState) {
  const isCurrent = tour.current.nodeId === node.id
  const isVisited = (reader.visited[tour.id] ?? []).includes(node.id)
  const isStale = (reader.stale[tour.id] ?? []).includes(node.id)

  return {
    isCurrent,
    mark: isCurrent ? '▸' : isVisited ? '✓' : ' ',
    flags: `${node.surprise ? ' !' : ''}${isStale ? ' ~' : ''}`,
  }
}

// A step in the rail: its title wraps under itself, beside mark and number.
function railStep(
  { Box, Text, Button }: Ui,
  node: TourNode,
  position: number,
  tour: Tour,
  reader: ReaderState,
  onPress: () => Promise<void>,
) {
  const { isCurrent, mark, flags } = stepState(node, tour, reader)

  return (
    <Box flexDirection="row" width={RAIL_COLUMNS}>
      <Box width={5} flexShrink={0}>
        <Text color={isCurrent ? ACCENT : undefined} dimColor={!isCurrent}>
          {`${mark} ${String(position + 1).padStart(2)} `}
        </Text>
      </Box>
      <Box flexShrink={1}>
        <Button key={`node-${node.id}`} plain onPress={onPress}>
          <Text bold={isCurrent} backgroundColor={isCurrent ? CURRENT_STEP_ROW : undefined}>
            {node.title}
          </Text>
          <Text color="warning">{flags}</Text>
        </Button>
      </Box>
    </Box>
  )
}

// A step on one line, for a narrow pane: the title cut with an ellipsis to
// leave room for the flags and the file, which stay whole.
function stepRow(node: TourNode, position: number, tour: Tour, reader: ReaderState, width: number): string {
  const { mark, flags } = stepState(node, tour, reader)
  const file = node.anchors[0]?.file.split('/').slice(-2).join('/') ?? ''
  const head = `${mark} ${String(position + 1).padStart(2)}  `
  const tail = `${flags}  ${file}`
  const room = Math.max(8, width - head.length - tail.length)
  const title = node.title.length > room ? `${node.title.slice(0, room - 1)}…` : node.title.padEnd(room)

  return `${head}${title}${tail}`.slice(0, width)
}

// The story's fields at the reader's depth, in the lens the pane shows.
function storyFields(tour: Tour, node: TourNode, reader: ReaderState, depth: number, isStale: boolean): Field[] {
  const isCode = isCodeTour(tour)
  const otherLens = tour.lens === 'flow' ? 'domain' : 'flow'
  const lensText = reader.isOtherLensShown ? node.otherLens : node
  const fields: Field[] = []
  const add = (label: string, text: string | undefined, color?: string) => {
    if (text) fields.push({ label, text, ...(color ? { color } : {}) })
  }

  if (reader.isOtherLensShown) {
    add('', `${otherLens} lens`)
  }

  if (reader.isOtherLensShown && !node.otherLens) {
    add('', `Writing the ${otherLens} lens for this step…`)
    return fields
  }

  if (isStale) {
    add('~', 'The code under this step changed since the tour was written. Press r to refresh it.', 'warning')
  }

  if (depth === 0) {
    add('', lensText?.summary ?? node.summary)
  }

  add('! Surprise', node.surprise, 'warning')

  if (depth >= 1) {
    add('Confirms', node.confirms)
    add(isCode ? 'Does' : 'What', lensText?.whatChanged ?? lensText?.whatItDoes)
    add('Why', whyText(lensText?.why, isCode))
    add(isCode ? 'Carry on' : 'Carry', node.carryForward, ACCENT_SOFT)
  }

  if (depth >= 2) {
    add('Detail', node.detail)
    add('Ask next', node.suggestedQuestion)
  }

  if (depth < 2) {
    add('', `Press e for more (${depth === 0 ? 'what, why, carry' : 'detail, next question'}).`)
  }

  return fields
}

// The headline wraps with a hanging indent under its number, beside the
// plan as a chip; each field's text wraps under itself, not its label.
function storyPanel({ Box, Text }: Ui, tour: Tour, node: TourNode, reader: ReaderState, fields: Field[], width: number) {
  const number = `${tour.path.indexOf(node.id) + 1}`.padEnd(3)
  const chip = chipText(tour, node)

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row">
        <Box width={number.length} flexShrink={0}>
          <Text bold color={ACCENT}>
            {number}
          </Text>
        </Box>
        <Box flexShrink={1} width={Math.max(10, width - number.length - chip.length - 2)}>
          <Text bold>{node.title}</Text>
        </Box>
        <Box flexShrink={0} marginLeft={1}>
          <Text dimColor backgroundColor={CHIP}>{chip}</Text>
        </Box>
      </Box>
      {fields.map((field) =>
        field.label ? (
          <Box flexDirection="row">
            <Box width={FIELD_WIDTH} flexShrink={0}>
              <Text dimColor color={field.color === 'warning' ? 'warning' : undefined}>
                {field.label}
              </Text>
            </Box>
            <Box flexShrink={1}>
              <Text color={field.color}>{field.text}</Text>
            </Box>
          </Box>
        ) : (
          <Box marginLeft={number.length}>
            <Text dimColor={field.text.startsWith('Press e')}>{field.text}</Text>
          </Box>
        ),
      )}
    </Box>
  )
}

function chipText(tour: Tour, node: TourNode): string {
  return node.plan ? ` ${isCodeTour(tour) ? 'role: ' : ''}${node.plan} ` : ''
}

// How many rows the story takes once wrapped, to size the code under it.
function storyRows(node: TourNode | undefined, fields: Field[], width: number): number {
  if (!node) return 0

  const wrapped = (text: string, room: number) => Math.max(1, Math.ceil(text.length / Math.max(10, room)))

  return (
    wrapped(node.title, width - 4 - node.plan.length - 8) +
    fields.reduce((sum, field) => sum + wrapped(field.text, width - (field.label ? FIELD_WIDTH : 3) - 1), 0)
  )
}

// The code panel folded to one line: where the code is, and how to open it.
function foldedCode({ Text }: Ui, node: TourNode, reader: ReaderState, code: CodeView) {
  const count = node.beacons.length
  const which = count > 1 ? ` · beacon ${(reader.beaconIndex % count) + 1} of ${count}` : ''

  return (
    <Text dimColor wrap="truncate-end">
      {code.path} {code.heading}
      {which}
      {'   '}c shows the code
    </Text>
  )
}

function progressMarks(tour: Tour, reader: ReaderState): string {
  const visited = reader.visited[tour.id] ?? []

  return tour.path.map((id) => (id === tour.current.nodeId ? '▸' : visited.includes(id) ? '✓' : '○')).join('')
}

// The code, folded and windowed around the current beacon, a scroll track
// beside it with the beacons ticked, and the step's beacons listed under.
function codePanel(ui: Ui, node: TourNode, reader: ReaderState, code: CodeView, height: number, width: number) {
  const { Box, Text } = ui
  const count = node.beacons.length
  const current = count > 0 ? reader.beaconIndex % count : -1
  const beacons: WindowBeacon[] = node.beacons
    .map((beacon, index) => ({ beacon, index }))
    .filter(({ beacon }) => beacon.file === code.path)
    .map(({ beacon, index }) => ({ line: beacon.line, index, isCurrent: index === current }))
  const view = codeWindow(foldRows(code.rows, beacons, !reader.isCodeFolded), height, reader.codeOffset)
  const numbers = view.rows.flatMap((row) => (row.kind === 'row' && row.row.number !== null ? [row.row.number] : []))
  const gutter = Math.max(2, ...numbers.map((number) => String(number).length))

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={BORDER} paddingX={1}>
      <Box flexDirection="row" columnGap={2}>
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end">
            <Text bold>{code.path}</Text>
            <Text dimColor>
              {'  '}
              {code.heading}
              {view.hidden.above + view.hidden.below > 0 ? `  · ${view.hidden.above} above, ${view.hidden.below} below` : ''}
            </Text>
          </Text>
        </Box>
        <Text>
          {badge(ui, 'c')}
          <Text dimColor> hide</Text>
        </Text>
      </Box>
      <Box flexDirection="row">
        <Box flexDirection="column" flexShrink={1} width={Math.max(10, width - 3 - CARD_COLUMNS)}>
          {codeRuns(view.rows, code).map((run) => drawRun(ui, run, code, gutter))}
        </Box>
        {view.track.length > 0 && (
          <Box flexDirection="column" width={1} flexShrink={0}>
            {view.track.map((cell) =>
              cell === 'current' ? (
                <Text color={ACCENT}>◆</Text>
              ) : cell === 'beacon' ? (
                <Text>•</Text>
              ) : (
                <Text dimColor>{cell === 'window' ? '┃' : '│'}</Text>
              ),
            )}
          </Box>
        )}
      </Box>
      {node.beacons.map((beacon, index) => (
        <Text color={index === current ? ACCENT : undefined} dimColor={index !== current} wrap="truncate-end">
          {index === current ? '●' : '○'} {index + 1} {beacon.file === code.path ? '' : `${beacon.file} `}L{beacon.line}
          {'  '}
          {beacon.label}
        </Text>
      ))}
      <Text dimColor wrap="truncate-end">
        {badge(ui, 'b')} next beacon  {badge(ui, 'n p')} scroll  {badge(ui, 'f')} {reader.isCodeFolded ? 'unfold' : 'fold'}  {badge(ui, 'o')}{' '}
        {code.isWholeFile ? 'the step' : 'whole file'}
      </Text>
    </Box>
  )
}

type Run = { kind: 'plain'; rows: CodeRow[] } | { kind: 'single'; row: VisualRow }

// Plain source lines drawn together through the Code element, for syntax
// colour; beacon lines, changed lines and folds one by one.
function codeRuns(rows: VisualRow[], code: CodeView): Run[] {
  const runs: Run[] = []

  for (const row of rows) {
    const last = runs.at(-1)
    const isPlain = code.format === 'source' && row.kind === 'row' && !row.beacon

    if (isPlain && last?.kind === 'plain') {
      last.rows.push(row.row)
    } else if (isPlain) {
      runs.push({ kind: 'plain', rows: [row.row] })
    } else {
      runs.push({ kind: 'single', row })
    }
  }

  return runs
}

function drawRun({ Box, Text, Code }: Ui, run: Run, code: CodeView, gutter: number) {
  const number = (row: CodeRow) => (row.number === null ? '' : String(row.number)).padStart(gutter)

  if (run.kind === 'plain') {
    return (
      <Box flexDirection="row">
        <Box flexDirection="column" width={gutter + 4} flexShrink={0}>
          {run.rows.map((row) => (
            <Text dimColor>{` ${number(row)}   `}</Text>
          ))}
        </Box>
        <Code source={run.rows.map((row) => row.text).join('\n')} path={code.path} wrap="truncate-end" />
      </Box>
    )
  }

  const { row } = run

  if (row.kind === 'fold') {
    return (
      <Text dimColor backgroundColor={FOLD_ROW} wrap="truncate-end">
        {` ${'⋯'.padStart(gutter)}   ${row.count} lines folded · f unfolds`}
      </Text>
    )
  }

  const color = row.row.marker === '+' ? ADDED : row.row.marker === '-' ? REMOVED : undefined
  const line = `${number(row.row)} ${row.row.marker} ${row.row.text}`
  // One column before the number: the current beacon's bar, else blank.
  const bar = row.beacon?.isCurrent ? <Text color={ACCENT}>▌</Text> : <Text> </Text>

  if (!row.beacon) {
    return (
      <Text color={color} wrap="truncate-end">
        {` ${line}`}
      </Text>
    )
  }

  return (
    <Box flexDirection="row">
      {bar}
      <Box flexGrow={1} flexShrink={1}>
        <Text
          bold={row.beacon.isCurrent}
          color={color}
          backgroundColor={row.beacon.isCurrent ? CURRENT_BEACON_ROW : BEACON_ROW}
          wrap="truncate-end"
        >
          {line}
        </Text>
      </Box>
      <Text color={row.beacon.isCurrent ? ACCENT : undefined} dimColor={!row.beacon.isCurrent}>
        {` ${row.beacon.isCurrent ? '◀' : '◁'} ${row.beacon.index + 1}`}
      </Text>
    </Box>
  )
}

// A key as a badge, as the design draws keys.
function badge({ Text }: Ui, keys: string) {
  return (
    <Text bold color="text" backgroundColor={BORDER}>
      {` ${keys} `}
    </Text>
  )
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
