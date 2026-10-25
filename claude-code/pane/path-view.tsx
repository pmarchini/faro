import { atom, read } from 'claude-code'
import type { Elements, EngineInterface, On, RenderChildren } from 'claude-code'

import { MAIN_PATH_ID, pathSteps, type Tour, type TourBeacon, type TourNode, type TourWhy } from '../../src/core/model/tour.ts'
import { currentPathId, getTour, pathPosition, subPathsAt } from '../../src/core/services/tour-machine.ts'
import { codeWindow, foldRows, type VisualRow, type WindowBeacon } from '../code-window.ts'
import { compactFiles, railFiles, type TreeFile } from '../file-tree.ts'
import { EMPTY_DOCUMENT, EMPTY_READER, PANE } from '../state.ts'
import type { FaroCodeRow as CodeRow, FaroCodeView as CodeView, FaroReader as ReaderState } from '../types'
import { enterSubPath, runAction, selectLine, selectNode } from './actions.ts'
import { PANE_KEYS } from './keys.ts'
import { LOGO_ROWS, LOGO_WIDTH, WORDMARK, logoSegments } from './logo.ts'
import { tokens, type TokenKind } from './syntax.ts'
import { breadcrumb, isWriting, mapRows, rowText, stepRows, type StepRow, type TreeRow } from './path-tree.ts'
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
  PICKED_ROW,
  REMOVED,
  SUB_ACCENT,
  SUMMARY,
  SYNTAX_COMMENT,
  SYNTAX_KEYWORD,
  SYNTAX_NUMBER,
  SYNTAX_STRING,
} from './theme.ts'

const TOKEN_COLORS: Record<TokenKind, string | undefined> = {
  keyword: SYNTAX_KEYWORD,
  string: SYNTAX_STRING,
  number: SYNTAX_NUMBER,
  comment: SYNTAX_COMMENT,
  plain: undefined,
}

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
type Engine = EngineInterface
type Field = { label: string; text: string; color?: string; isSummary?: boolean }

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
    const isSubPath = currentPathId(tour) !== MAIN_PATH_ID
    const tree = stepRows(tour, reader)
    const stale = reader.stale[tour.id] ?? []
    const isCodeFolded = isShort ? !reader.isCodeToggled : reader.isCodeToggled
    const depth = tour.current.depth
    const keys = PANE_KEYS.filter(
      (key) =>
        (key.action !== 'refresh' || (node && stale.includes(node.id))) &&
        (key.action !== 'files' || !isShort) &&
        (key.action !== 'steps' || isShort) &&
        (key.action !== 'surface' || isSubPath) &&
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
    const dives = node ? diveRows(tour, node, reader) : []
    const story =
      node &&
      (reader.isMapShown ? mapPanel(ui, $, tour, reader) : storyPanel(ui, $, tour, node, reader, fields, dives, readerWidth))
    const plainSteps = tree.map((row) => treeRowLine(ui, $, row, width))

    if (isShort) {
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end">
            {mark(ui)} {isSubPath ? `${breadcrumb(tour)} ` : ''}
            {index + 1}/{total} {progressMarks(tour, reader)}
            <Text dimColor>
              {'  '}
              {isCodeTour(tour) ? 'code tour · ' : ''}
              {tour.lens}
            </Text>
          </Text>
          {reader.isStepListShown && plainSteps}
          {story}
          {node && code && code.nodeId === node.id && !reader.isMapShown && foldedCode(ui, node, reader, code)}
          {footer}
        </Box>
      )
    }

    // The rows the code may take: the pane's height less everything else.
    const stackedRows = isRail ? 0 : tree.length + 1 + (reader.isFileTreeHidden ? 1 : compactFiles(treeFiles(tour, reader)).length + 1)
    const beaconRows = node ? beaconListRows(node, readerWidth) + 1 : 0
    const footerRows = Math.ceil(keys.reduce((sum, key) => sum + key.label.length + 5, 0) / width)
    const codeRows = Math.max(
      MIN_CODE_ROWS,
      rows - 2 - headRows(tour, width) - stackedRows - storyRows(node, fields, readerWidth) - dives.length - 1 - beaconRows - footerRows - CARD_ROWS,
    )
    const codeSection =
      node &&
      code &&
      code.nodeId === node.id &&
      !reader.isMapShown &&
      (isCodeFolded ? foldedCode(ui, node, reader, code) : codePanel(ui, $, tour, node, reader, code, codeRows, readerWidth))
    const header = (
      <Text>
        {mark(ui)}
        {'  '}
        <Text bold>{breadcrumb(tour)}</Text>
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
          <Text dimColor>
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
        <Text dimColor>
          {tour.hypothesis}
        </Text>
        <Text dimColor>{rule}</Text>
        <Box flexDirection="row" columnGap={1}>
          <Box flexDirection="column" width={RAIL_COLUMNS} flexShrink={0} backgroundColor={RAIL}>
            <Box marginLeft={Math.floor((RAIL_COLUMNS - LOGO_WIDTH) / 2)}>{logo(ui)}</Box>
            <Text dimColor>STEPS</Text>
            {tree.map((row) => railRow(ui, $, row))}
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

// Each file the tour anchors in, with the steps of the path being read that
// read it.
function treeFiles(tour: Tour, reader: ReaderState): TreeFile[] {
  const files = new Map<string, TreeFile>()
  const visited = reader.visited[tour.id] ?? []
  const current = tour.current.nodeId
  const steps = pathSteps(tour, currentPathId(tour)) ?? tour.path

  for (const node of Object.values(tour.nodes)) {
    const step = steps.indexOf(node.id) + 1

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

// A row of the rail's tree: a step, its title wrapping under itself beside
// mark and number and indented by how deep its path is; a sub path off the
// trail, which a press enters; or the sub path Claude is writing.
function railRow({ Box, Text, Button }: Ui, $: Engine, row: TreeRow) {
  const indent = row.level * 2

  if (row.kind !== 'step') {
    return (
      <Box flexDirection="row" width={RAIL_COLUMNS} paddingLeft={5 + indent - 2}>
        {row.kind === 'subPath' ? (
          <Button key={`path-${row.subPath.id}`} plain onPress={() => enterSubPath($, row.subPath.id)}>
            <Text color={SUB_ACCENT}>↳ </Text>
            <Text dimColor={row.isOpen}>{row.subPath.title}</Text>
          </Button>
        ) : (
          <Text dimColor>{row.kind === 'writing' ? '↳ writing…' : `◆ ${row.question}`}</Text>
        )}
      </Box>
    )
  }

  const accent = row.level > 0 ? SUB_ACCENT : ACCENT

  return (
    <Box flexDirection="row" width={RAIL_COLUMNS}>
      <Box width={5 + indent} flexShrink={0}>
        <Text color={row.isCurrent ? accent : undefined} dimColor={!row.isCurrent}>
          {`${row.mark} ${' '.repeat(indent)}${String(row.position + 1).padStart(2)} `}
        </Text>
      </Box>
      <Box flexShrink={1}>
        <Button key={stepKey(row)} plain onPress={() => selectNode($, row.node.id, row.pathId)}>
          <Text bold={row.isCurrent} backgroundColor={row.isCurrent ? CURRENT_STEP_ROW : undefined}>
            {row.node.title}
          </Text>
          <Text color="warning">{row.flags}</Text>
        </Button>
      </Box>
    </Box>
  )
}

// A row of the tree on one line, for a narrow pane.
function treeRowLine({ Text, Button }: Ui, $: Engine, row: TreeRow, width: number) {
  switch (row.kind) {
    case 'step':
      return (
        <Button key={stepKey(row)} plain onPress={() => selectNode($, row.node.id, row.pathId)}>
          {stepLine(row, width)}
        </Button>
      )
    case 'subPath':
      return (
        <Button key={`path-${row.subPath.id}`} plain onPress={() => enterSubPath($, row.subPath.id)}>
          {`      ${rowText(row, false)}`.slice(0, width)}
        </Button>
      )
    default:
      return (
        <Text dimColor wrap="truncate-end">
          {`      ${rowText(row, false)}`}
        </Text>
      )
  }
}

// Steps of the main path keep their plain key; a sub path's carry its id.
function stepKey(row: StepRow): string {
  return row.pathId === MAIN_PATH_ID ? `node-${row.node.id}` : `node-${row.pathId}-${row.node.id}`
}

// A step on one line, for a narrow pane: the title cut with an ellipsis to
// leave room for the flags and the file, which stay whole.
function stepLine(row: StepRow, width: number): string {
  const { node, mark, flags } = row
  const file = node.anchors[0]?.file.split('/').slice(-2).join('/') ?? ''
  const head = `${mark} ${String(row.position + 1).padStart(2)}  ${'  '.repeat(row.level)}`
  const tail = `${flags}  ${file}`
  const room = Math.max(8, width - head.length - tail.length)
  const title = node.title.length > room ? `${node.title.slice(0, room - 1)}…` : node.title.padEnd(room)

  return `${head}${title}${tail}`.slice(0, width)
}

// Under the story, where this step leads deeper: the sub paths written from
// it (a press enters one), the one Claude is writing, or the dive the tour
// offers.
type DiveRow = { key: string; text: string; pathId?: string; isDim?: boolean }

function diveRows(tour: Tour, node: TourNode, reader: ReaderState): DiveRow[] {
  const pathId = currentPathId(tour)
  const written = subPathsAt(tour, pathId, node.id)
  const rows: DiveRow[] = written.map((subPath) => ({
    key: `dive-${subPath.id}`,
    text: `↳ ${subPath.title} · ${subPath.steps.length} steps${subPath.anchor.line ? ` · from L${subPath.anchor.line}` : ''}`,
    pathId: subPath.id,
  }))

  if (isWriting(tour, reader, pathId, node.id)) {
    const line = reader.diving?.line
    rows.push({ key: 'dive-writing', text: `↳ Claude is writing a sub path${line ? ` from L${line}` : ''}… keep reading`, isDim: true })
  } else if (node.dive && !written.some((subPath) => subPath.anchor.line === undefined)) {
    rows.push({ key: 'dive-offered', text: `◆ ${node.dive.question}  d dives`, isDim: true })
  }

  return rows
}

// The map: every path as an indented tree, the dives offered but not yet
// written among them; a press on a step goes there.
function mapPanel({ Box, Text, Button }: Ui, $: Engine, tour: Tour, reader: ReaderState) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text bold>Map of paths</Text>
      <Text dimColor>{tour.title}</Text>
      {mapRows(tour, reader).map((row) =>
        row.kind === 'step' ? (
          <Button key={`map-${row.pathId}-${row.node.id}`} plain onPress={() => selectNode($, row.node.id, row.pathId)}>
            <Text bold={row.isCurrent} color={row.isCurrent ? (row.level > 0 ? SUB_ACCENT : ACCENT) : undefined}>
              {rowText(row, true)}
            </Text>
          </Button>
        ) : (
          <Text color={row.kind === 'subPath' ? SUB_ACCENT : undefined} dimColor={row.kind !== 'subPath'} wrap="truncate-end">
            {rowText(row, true)}
          </Text>
        ),
      )}
      <Text dimColor>m goes back to the step</Text>
    </Box>
  )
}

// The story's fields at the reader's depth, in the lens the pane shows.
function storyFields(tour: Tour, node: TourNode, reader: ReaderState, depth: number, isStale: boolean): Field[] {
  const isCode = isCodeTour(tour)
  const otherLens = tour.lens === 'flow' ? 'domain' : 'flow'
  const lensText = reader.isOtherLensShown ? node.otherLens : node
  const fields: Field[] = []
  const add = (label: string, text: string | undefined, color?: string, isSummary = false) => {
    if (text) fields.push({ label, text, ...(color ? { color } : {}), ...(isSummary ? { isSummary } : {}) })
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
    add('', lensText?.summary ?? node.summary, undefined, true)
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
function storyPanel(
  { Box, Text, Button }: Ui,
  $: Engine,
  tour: Tour,
  node: TourNode,
  reader: ReaderState,
  fields: Field[],
  dives: DiveRow[],
  width: number,
) {
  const number = `${pathPosition(tour).index + 1}`.padEnd(3)
  const chip = chipText(tour, node)
  const accent = currentPathId(tour) === MAIN_PATH_ID ? ACCENT : SUB_ACCENT

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row">
        <Box width={number.length} flexShrink={0}>
          <Text bold color={accent}>
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
          <Box marginLeft={number.length} {...(field.isSummary ? { backgroundColor: SUMMARY, paddingX: 1 } : {})}>
            <Text dimColor={field.text.startsWith('Press e')}>{field.text}</Text>
          </Box>
        ),
      )}
      {dives.map((dive) => (
        <Box marginLeft={number.length}>
          {dive.pathId ? (
            <Button key={dive.key} plain onPress={() => enterSubPath($, dive.pathId ?? '')}>
              <Text color={SUB_ACCENT}>{dive.text}</Text>
            </Button>
          ) : (
            <Text dimColor={dive.isDim}>{dive.text}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

function chipText(tour: Tour, node: TourNode): string {
  return node.plan ? ` ${isCodeTour(tour) ? 'role: ' : ''}${node.plan} ` : ''
}

// The rows the header and the hypothesis take once wrapped: neither is cut,
// so a long title or hypothesis is read whole.
function headRows(tour: Tour, width: number): number {
  const header = `o-^-o faro  ${tour.title}  code tour  ${tour.lens}  00/00`
  return Math.ceil(header.length / width) + Math.ceil(tour.hypothesis.length / width)
}

// How many rows the story takes once wrapped, to size the code under it.
function storyRows(node: TourNode | undefined, fields: Field[], width: number): number {
  if (!node) return 0

  const wrapped = (text: string, room: number) => Math.max(1, Math.ceil(text.length / Math.max(10, room)))

  return (
    wrapped(node.title, width - 4 - node.plan.length - 8) +
    fields.reduce((sum, field) => sum + wrapped(field.text, width - (field.label ? FIELD_WIDTH : field.isSummary ? 5 : 3) - 1), 0)
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

  return (pathSteps(tour, currentPathId(tour)) ?? tour.path).map((id) => (id === tour.current.nodeId ? '▸' : visited.includes(id) ? '✓' : '○')).join('')
}

// The code, folded and windowed around the current beacon, a scroll track
// beside it with the beacons ticked, and the step's beacons listed under.
// Every numbered line is clickable: a click picks it, to dive or ask from.
function codePanel(
  ui: Ui,
  $: Engine,
  tour: Tour,
  node: TourNode,
  reader: ReaderState,
  code: CodeView,
  height: number,
  width: number,
) {
  const { Box, Text, Button } = ui
  const count = node.beacons.length
  const current = count > 0 ? reader.beaconIndex % count : -1
  const beacons: WindowBeacon[] = node.beacons
    .map((beacon, index) => ({ beacon, index }))
    .filter(({ beacon }) => beacon.file === code.path)
    .map(({ beacon, index }) => ({ line: beacon.line, index, isCurrent: index === current }))
  const view = codeWindow(foldRows(code.rows, beacons, !reader.isCodeFolded), height, reader.codeOffset)
  const numbers = view.rows.flatMap((row) => (row.kind === 'row' && row.row.number !== null ? [row.row.number] : []))
  const gutter = Math.max(2, ...numbers.map((number) => String(number).length))
  const picked = reader.selectedLine?.nodeId === node.id && reader.selectedLine.file === code.path ? reader.selectedLine : null
  const written = new Set(
    subPathsAt(tour, currentPathId(tour), node.id).flatMap((subPath) =>
      subPath.anchor.file === code.path && subPath.anchor.line ? [subPath.anchor.line] : [],
    ),
  )
  const line: LineContext = {
    code,
    gutter,
    nodeId: node.id,
    picked: picked?.line ?? null,
    written,
    room: Math.max(10, width - 3 - CARD_COLUMNS),
  }

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
          {view.rows.map((row) => drawRow(ui, $, row, line))}
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
      {node.beacons.map((beacon, index) => {
        const isCurrent = index === current
        const where = beaconWhere(beacon, index, isCurrent, code.path)

        return (
          <Box flexDirection="row">
            <Box width={where.length} flexShrink={0}>
              <Text color={isCurrent ? ACCENT : undefined} dimColor={!isCurrent}>
                {where}
              </Text>
            </Box>
            <Box flexShrink={1}>
              <Text>
                <Text bold={isCurrent} color={isCurrent ? ACCENT : undefined} dimColor={!isCurrent}>
                  {beacon.label}
                </Text>
                <Text dimColor={!isCurrent}>{beacon.note ? `  ${beacon.note}` : ''}</Text>
              </Text>
            </Box>
          </Box>
        )
      })}
      {picked ? (
        <Box flexDirection="row" columnGap={2}>
          <Text color={SUB_ACCENT}>{`▸ L${picked.line} picked`}</Text>
          <Button key="pick-dive" plain onPress={() => runAction($, 'dive')}>
            {badge(ui, 'd')}
            <Text> {written.has(picked.line) ? 'enter its sub path' : 'dive here'}</Text>
          </Button>
          <Button key="pick-ask" plain onPress={() => runAction($, 'ask')}>
            {badge(ui, 'a')}
            <Text> ask</Text>
          </Button>
          <Text dimColor wrap="truncate-end">
            {badge(ui, 'n p')} move · click it again to let go
          </Text>
        </Box>
      ) : (
        <Text dimColor wrap="truncate-end">
          {badge(ui, 'b')} next beacon  {badge(ui, 'n p')} scroll  {badge(ui, 'f')} {reader.isCodeFolded ? 'unfold' : 'fold'}  {badge(ui, 'o')}{' '}
          {code.isWholeFile ? 'the step' : 'whole file'}  · click a line to dive from it
        </Text>
      )}
    </Box>
  )
}

// A beacon's mark, number and line, before its label and note.
function beaconWhere(beacon: TourBeacon, index: number, isCurrent: boolean, path: string): string {
  return `${isCurrent ? '●' : '○'} ${index + 1} ${beacon.file === path ? '' : `${beacon.file} `}L${beacon.line}  `
}

// The rows the beacon list takes once each label and note wraps.
function beaconListRows(node: TourNode, width: number): number {
  return node.beacons.reduce((sum, beacon, index) => {
    const room = Math.max(10, width - CARD_COLUMNS - beaconWhere(beacon, index, false, beacon.file).length)
    const text = `${beacon.label}${beacon.note ? `  ${beacon.note}` : ''}`
    return sum + Math.max(1, Math.ceil(text.length / room))
  }, 0)
}

type LineContext = {
  code: CodeView
  gutter: number
  nodeId: string
  // The picked line's number, and the lines a sub path was written from.
  picked: number | null
  written: Set<number>
  // The columns a row may take.
  room: number
}

// One row of the code: a fold, a line a diff removed, or a numbered line,
// which is a button that picks it, drawn on a tinted ground once picked.
function drawRow({ Box, Text, Button }: Ui, $: Engine, row: VisualRow, line: LineContext) {
  const { code, gutter } = line
  const number = (codeRow: CodeRow) => (codeRow.number === null ? '' : String(codeRow.number)).padStart(gutter)

  if (row.kind === 'fold') {
    return (
      <Text dimColor backgroundColor={FOLD_ROW} wrap="truncate-end">
        {` ${'⋯'.padStart(gutter)}   ${row.count} lines folded · f unfolds`}
      </Text>
    )
  }

  const { row: codeRow, beacon } = row
  const color = codeRow.marker === '+' ? ADDED : codeRow.marker === '-' ? REMOVED : undefined

  if (codeRow.number === null) {
    return (
      <Text color={color} wrap="truncate-end">
        {` ${number(codeRow)} ${codeRow.marker} ${codeRow.text}`}
      </Text>
    )
  }

  const lineNumber = codeRow.number
  const isPicked = line.picked === lineNumber
  const background = isPicked ? PICKED_ROW : beacon ? (beacon.isCurrent ? CURRENT_BEACON_ROW : BEACON_ROW) : undefined
  const head = `${number(codeRow)} ${codeRow.marker} `
  const tail = `${line.written.has(lineNumber) ? ' ↳' : ''}${beacon ? ` ${beacon.isCurrent ? '◀' : '◁'} ${beacon.index + 1}` : ''}`
  const room = Math.max(4, line.room - 1 - head.length - tail.length)
  const text = codeRow.text.length > room ? `${codeRow.text.slice(0, room - 1)}…` : codeRow.text
  // A diff's added and removed lines keep their colour; other lines are
  // coloured by token.
  const parts = color ? [{ text, kind: 'plain' as const }] : tokens(text, code.path)
  // One column before the number: the pick, the current beacon's bar, or blank.
  const bar = isPicked ? (
    <Text color={SUB_ACCENT}>▸</Text>
  ) : beacon?.isCurrent ? (
    <Text color={ACCENT}>▌</Text>
  ) : (
    <Text> </Text>
  )

  // The whole line is the button: a click anywhere on it picks it, and the
  // terminal inverts it under the pointer.
  return (
    <Box key={`row-${lineNumber}`} flexDirection="row">
      {bar}
      <Button
        key={`line-${lineNumber}`}
        plain
        onPress={() => selectLine($, { nodeId: line.nodeId, file: code.path, line: lineNumber, text: codeRow.text })}
      >
        <Text dimColor={!isPicked} color={isPicked ? SUB_ACCENT : undefined} backgroundColor={background}>
          {head}
        </Text>
        {parts.map((part) => (
          <Text
            bold={isPicked || beacon?.isCurrent}
            color={color ?? TOKEN_COLORS[part.kind]}
            dimColor={part.kind === 'comment'}
            backgroundColor={background}
          >
            {part.text}
          </Text>
        ))}
      </Button>
      {tail && (
        <Text color={beacon?.isCurrent || line.written.has(lineNumber) ? (beacon?.isCurrent ? ACCENT : SUB_ACCENT) : undefined} dimColor={Boolean(beacon) && !beacon?.isCurrent}>
          {tail}
        </Text>
      )}
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
