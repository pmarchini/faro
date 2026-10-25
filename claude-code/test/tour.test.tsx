import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'faro',
  component: 'Pane',
  requestId: 'faro-tour',
  props: {
    title: 'Faro tour',
    isFocused: true,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// What the engine stamps on a command the person typed.
const TYPED = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

const SOURCE = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n')

function node(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title,
    plan: 'guard clause',
    summary: `Summary of ${id}`,
    whatChanged: `Change in ${id}`,
    why: { text: `Reason for ${id}`, source: 'inferred' },
    beacons: [{ label: `${id}()`, file: `src/${id}.ts`, line: 5, note: `where ${id} hands over` }],
    carryForward: `Carry ${id}`,
    detail: `Detail of ${id}`,
    suggestedQuestion: `What about ${id}?`,
    anchors: [{ file: `src/${id}.ts`, range: { startLine: 1, endLine: 10 } }],
    role: 'path',
    ...overrides,
  }
}

function tour(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-persistence',
    title: 'Session persistence',
    target: { kind: 'worktree', ref: 'HEAD' },
    goal: 'Why do sessions survive a restart?',
    hypothesis: 'Tokens are persisted before the login reply is sent.',
    lens: 'flow',
    reader: 'familiar',
    nodes: {
      login: node('login', 'Login request enters'),
      persist: node('persist', 'Tokens persisted before reply', { surprise: 'The write is awaited now.' }),
      reload: node('reload', 'Restart reloads sessions', { carryForward: undefined }),
    },
    edges: [{ from: 'login', to: 'persist', kind: 'calls' }],
    path: ['login', 'persist', 'reload'],
    current: { nodeId: 'login', depth: 0 },
    ...overrides,
  }
}

// The world beneath the plugin: each hook stands for the engine.
function engine(on: On, git: Record<string, string> = {}) {
  const submitted: string[] = []
  const filled: string[] = []

  mock.store(on)
  on('tool.register', (_, e) => ({ value: { tool: `mcp__faro__${e.name}` } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  const panes = { opened: 0, closed: 0 }
  const session = { id: 'session-1' }
  on('ui.open', () => {
    panes.opened += 1
    return { value: { isPlaced: true } }
  })
  on('session.id', () => ({ value: session.id }))
  on('ui.close', () => {
    panes.closed += 1
    return { value: undefined }
  })
  // Every .ts file under /repo exists, except under /repo/auth/.
  const isFile = (path: string) => path.startsWith('/repo/') && path.endsWith('.ts') && !path.startsWith('/repo/auth/')
  on('fs.read', (_, e) => {
    if (isFile(e.path)) return { value: SOURCE }
    throw new Error(`no such file: ${e.path}`)
  })
  on('session.cwd', () => ({ value: '/repo' }))
  on('fs.stat', (_, e) => {
    if (isFile(e.path)) return { value: { kind: 'file', isLink: false, size: 1, mtimeMs: 0 } }
    if (e.path.includes('src/')) return { value: { kind: 'dir', isLink: false, size: 0, mtimeMs: 0 } }
    throw new Error('missing')
  })
  on('process.run', (_, e) => {
    const stdout = git[e.argv.slice(1).join(' ')]
    return {
      value: {
        exitCode: stdout === undefined ? 1 : 0,
        stdout: stdout ?? '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('prompt.submit', (_, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  return { submitted, filled, panes, session }
}

test('tour_upsert stores a valid tour and returns advice on soft rules', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })

  expect(ran.deny).toBeUndefined()
  expect(String(ran.result)).toContain('3 nodes on the path')
  expect(String(ran.result)).not.toContain('reload has no carryForward')
})

test('tour_upsert refuses an invalid tour and lists every problem', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call({
    tool: 'mcp__faro__tour_upsert',
    tour: tour({ hypothesis: '', path: ['login', 'ghost'] }),
  })

  expect(ran.deny).toContain('hypothesis is required')
  expect(ran.deny).toContain('missing node ghost')
})

test('the pane walks the path and goes deeper, on every surface that takes keys', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })

  for (const surface of ['terminal', 'desktop'] as const) {
    await $.tool.call({ tool: 'mcp__faro__tour_focus', tourId: 'session-persistence', nodeId: 'login' })
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: /Tokens are persisted before the login reply/ })).toBeDefined()
    expect((await ui.find({ key: 'node-login' }))?.text).toContain('▸  1  Login request enters')
    expect((await ui.find({ key: 'node-persist' }))?.text).toContain('!')

    await ui.press({ key: 'key-next' })
    expect((await ui.find({ key: 'node-persist' }))?.text).toContain('▸')
    expect((await ui.find({ key: 'node-login' }))?.text).toContain('✓')
    expect(await ui.find({ type: 'Text', text: /Why/ })).toBeUndefined()

    await ui.press({ key: 'key-deeper' })
    expect(await ui.find({ type: 'Text', text: /Reason for persist \(inferred\)/ })).toBeDefined()

    await ui.press({ key: 'key-shallower' })
    await ui.unmount()
  }
})

test('the code is open by default, its beacons tinted and listed, and o shows the whole file', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /src\/login\.ts  L1–10 · 10 lines/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'line-5' }))?.text).toBe(' 5   line 5')
  expect(await ui.find({ type: 'Text', text: / ◀ 1$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^● 1 L5  $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^login\(\)  where login hands over$/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'line-10' }))?.text).toBe('10   line 10')

  await ui.press({ key: 'key-code' })
  expect(await ui.find({ type: 'Text', text: /whole file · 30 lines/ })).toBeDefined()

  await ui.press({ key: 'key-codePanel' })
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /c shows the code/ })).toBeDefined()
  await ui.unmount()
})

test('a file the tour names from a subfolder is found among the tracked files', async ($, on) => {
  engine(on, { 'rev-parse --show-toplevel': '/repo\n', 'ls-files --full-name': 'src/auth/login.ts\nsrc/persist.ts\n' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const login = node('login', 'Login request enters', {
    anchors: [{ file: 'auth/login.ts', range: { startLine: 1, endLine: 10 } }],
    beacons: [{ label: 'login()', file: 'auth/login.ts', line: 5 }],
  })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour({ nodes: { ...tour().nodes, login } }) })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /auth\/login\.ts  L1–10 · 10 lines/ })).toBeDefined()

  await $.tool.call({
    tool: 'mcp__faro__tour_upsert',
    tour: tour({ nodes: { ...tour().nodes, login: { ...login, anchors: [{ file: 'auth/gone.ts', range: { startLine: 1, endLine: 10 } }], beacons: [] } } }),
  })
  expect(await ui.find({ type: 'Text', text: /could not be read: not found from \/repo/ })).toBeDefined()
  await ui.unmount()
})

test('the code starts unfolded, f folds the lines far from a beacon, and n scrolls a long file', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const nodes = {
    ...tour().nodes,
    login: node('login', 'Login request enters', {
      anchors: [{ file: 'src/login.ts', range: { startLine: 1, endLine: 30 } }],
      beacons: [{ label: 'login()', file: 'src/login.ts', line: 15 }],
    }),
  }
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour({ nodes }) })
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, scroll: { offset: 0, bodyRows: 30 } }, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /lines folded/ })).toBeUndefined()

  await ui.press({ key: 'key-fold' })
  expect(await ui.find({ type: 'Text', text: /10 lines folded · f unfolds/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /11 lines folded/ })).toBeDefined()

  await ui.press({ key: 'key-fold' })
  expect(await ui.find({ type: 'Text', text: /lines folded/ })).toBeUndefined()
  const before = (await ui.find({ type: 'Text', text: /\d+ above, \d+ below/ }))?.text
  expect(before).toBeDefined()

  await ui.press({ key: 'key-scrollDown' })
  const after = (await ui.find({ type: 'Text', text: /\d+ above, \d+ below/ }))?.text
  expect(after).not.toBe(before)
  expect(await ui.find({ type: 'Text', text: '◆' })).toBeDefined()
  await ui.unmount()
})

test('the files section shows where the current step sits and h hides it', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^src\/  ▸ login\.ts  · persist\.ts/ })).toBeDefined()

  await ui.press({ key: 'key-next' })
  expect(await ui.find({ type: 'Text', text: /^src\/  ✓ login\.ts  ▸ persist\.ts/ })).toBeDefined()

  await ui.press({ key: 'key-files' })
  expect(await ui.find({ type: 'Text', text: /▸ persist\.ts/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /FILES  \(h shows\)/ })).toBeDefined()
  await ui.unmount()
})

test('the Faro logo heads the empty pane and the rail; the header reads o-^-o faro', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const lighthouse = { type: 'Text', text: /\[#\]/ } as const

  const empty = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await empty.find(lighthouse)).toBeDefined()
  expect(await empty.find({ type: 'Text', text: /F A R O/ })).toBeDefined()
  expect(await empty.find({ type: 'Text', text: /No tour yet/ })).toBeDefined()
  await empty.unmount()

  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const narrow = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await narrow.find(lighthouse)).toBeUndefined()
  expect(await narrow.find({ type: 'Text', text: /^o-\^-o faro  Session persistence  flow  1\/3$/ })).toBeDefined()
  await narrow.unmount()
})

test('a wide pane puts the logo, steps and files in a rail beside the reader, and h hides it', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 110 }, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /\[#\]/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^src\/$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^├ ▸ login\.ts$/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'node-persist' }))?.text).toContain('Tokens persisted before reply')

  await ui.press({ key: 'key-files' })
  expect(await ui.find({ type: 'Text', text: /\[#\]/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /FILES  \(h shows\)/ })).toBeDefined()
  await ui.unmount()
})

test('ask fills the prompt with the suggested question and lens asks Claude once', async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'key-ask' })
  expect(world.filled[0]).toContain('What about login?')
  expect(world.filled[0]).toContain('session-persistence › login')

  await ui.press({ key: 'key-lens' })
  expect(world.submitted).toHaveLength(1)
  expect(world.submitted[0]).toContain('domain lens')
  expect(await ui.find({ type: 'Text', text: /Writing the domain lens/ })).toBeDefined()

  await $.tool.call({
    tool: 'mcp__faro__tour_update_node',
    tourId: 'session-persistence',
    node: node('login', 'Login request enters', { otherLens: { summary: 'A person signs in.' } }),
  })
  expect(await ui.find({ type: 'Text', text: /A person signs in/ })).toBeDefined()

  await ui.press({ key: 'key-lens' })
  await ui.press({ key: 'key-lens' })
  expect(world.submitted).toHaveLength(1)
  await ui.unmount()
})

test("don't get it is recorded for tour_get and asks for a simpler node", async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'key-dontGet' })
  expect(world.submitted[0]).toContain("I don't get this step")

  const got = await $.tool.call({ tool: 'mcp__faro__tour_get' })
  expect(JSON.parse(String(got.result)).reader.dontGet).toEqual(['login'])
  await ui.unmount()
})

test('an edit under a node marks it stale', async ($, on) => {
  engine(on)
  on('tool.call', { tool: 'Edit' }, () => ({ result: {} }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })

  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/persist.ts', old_string: 'a', new_string: 'b' })

  const got = await $.tool.call({ tool: 'mcp__faro__tour_get' })
  expect(JSON.parse(String(got.result)).reader.stale).toEqual(['persist'])
})

test('/explain with no changes says so and asks Claude nothing', async ($, on) => {
  const world = engine(on, { 'status --porcelain': '' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  const ran = await $.command.run({ ...TYPED, command: 'explain', args: '' })

  expect(ran.text).toContain('No changes to explain')
  expect(world.submitted).toHaveLength(0)
})

test('/explain with a question drafts a tour and hands Claude the skill', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  const ran = await $.command.run({ ...TYPED, command: 'explain', args: '"how does this plugin work?" --lens domain' })
  await clock.advance(1)

  expect(ran.text).toContain('Drafting a tour')
  expect(world.submitted[0]).toContain('faro-author-paths skill')
  expect(world.submitted[0]).toContain('kind "question"')
  expect(world.submitted[0]).toContain('Lens: domain')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Drafting a tour/ })).toBeDefined()
  await ui.unmount()
})

test('/explain with a path explains existing code', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  await $.command.run({ ...TYPED, command: 'explain', args: 'src/auth:createSession' })
  await clock.advance(1)

  expect(world.submitted[0]).toContain('kind "code"')
})

test('/tour pin keeps a tour that /tour open brings back', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })

  expect((await $.command.run({ ...TYPED, command: 'tour', args: 'pin auth' })).text).toContain('as auth')
  expect((await $.command.run({ ...TYPED, command: 'tour', args: 'list' })).text).toContain('auth  Session persistence  (pinned)')
  expect((await $.command.run({ ...TYPED, command: 'tour', args: 'drop session-persistence' })).text).toContain('Dropped')
  expect((await $.command.run({ ...TYPED, command: 'tour', args: 'open auth' })).text).toContain('pinned tour auth')
})

test('a resumed session brings back its tour and opens the pane again', async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  await $.tool.call({ tool: 'mcp__faro__tour_focus', tourId: 'session-persistence', nodeId: 'persist' })
  // The state a new process starts with: no tour in memory.
  await $.command.run({ ...TYPED, command: 'tour', args: 'drop session-persistence' })
  const opened = world.panes.opened

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  expect(world.panes.opened).toBe(opened + 1)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Session persistence/ })).toBeDefined()
  await ui.unmount()
})

test('switching to another session from the picker swaps its tour in, or none', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const showsTour = async () => (await ui.find({ type: 'Text', text: /Session persistence/ })) !== undefined

  world.session.id = 'session-2'
  await clock.advance(1000)
  expect(await showsTour()).toBe(false)
  const closed = world.panes.closed
  expect(closed).toBeGreaterThan(0)

  world.session.id = 'session-1'
  await clock.advance(1000)
  expect(await showsTour()).toBe(true)
  await ui.unmount()
})

test('a long headline wraps under its number while its step row is cut with an ellipsis', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const long = 'Tokens are persisted before the login reply is sent, so a crash between reply and write can no longer lose a session'
  const nodes = { ...tour().nodes, login: node('login', long) }
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour({ nodes }) })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const row = await ui.find({ type: 'Button', key: 'node-login' })
  expect(row?.text).toMatch(/^▸  1  Tokens are persisted .*…  src\/login\.ts$/)
  expect(row?.text.length).toBeLessThanOrEqual(70)
  expect(await ui.find({ type: 'Text', text: long })).toBeDefined()
  await ui.unmount()
})

test('the title and hypothesis wrap instead of being cut', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const hypothesis = 'ProfileApprovalManager is the single gate: it only lets a payment profile become verified once a KYC check passes, unless a risk rule waives it.'
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour({ hypothesis }) })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  // Whether `text` is drawn under an element that cuts its line.
  const isCut = (element: Drawn, text: string, isUnderCut = false): boolean => {
    const cuts = isUnderCut || String(element.props?.wrap ?? '').startsWith('truncate')
    return (element.children ?? []).some((child) =>
      child === text ? cuts : typeof child === 'object' && child !== null && isCut(child as Drawn, text, cuts),
    )
  }
  const tree = (await ui.drawn()) as Drawn

  expect(JSON.stringify(tree)).toContain(hypothesis)
  expect(isCut(tree, hypothesis)).toBe(false)
  expect(isCut(tree, 'Session persistence')).toBe(false)
  await ui.unmount()
})

test('a short pane shows a breadcrumb and the current step, and t lists the steps', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, scroll: { offset: 0, bodyRows: 12 } }, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /faro 1\/3 ▸○○/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'node-persist' })).toBeUndefined()
  expect(await ui.find({ type: 'Code' })).toBeUndefined()

  await ui.press({ key: 'key-steps' })
  expect(await ui.find({ type: 'Button', key: 'node-persist' })).toBeDefined()
  await ui.unmount()
})

test('a tour of existing code reads as one: no diff, read-only code, Does and Carry on', async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const question = { kind: 'question', ref: 'how do sessions live?' }
  await $.tool.call({
    tool: 'mcp__faro__tour_upsert',
    tour: tour({ target: question, current: { nodeId: 'login', depth: 1 } }),
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The question is the tour's goal; in the header it would push the step count off.
  expect(await ui.find({ type: 'Text', text: /^ code tour $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /L1–10 · 10 lines · read only/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Carry on$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ role: guard clause $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /inferred: no commit says so/ })).toBeDefined()
  await ui.unmount()
})

const SIGNING = {
  id: 'signing',
  title: 'How a token is signed',
  question: 'What does persist sign?',
  anchor: { path: 'main', node: 'persist' },
  steps: ['claims', 'keys'],
}

const SIGNING_NODES = [node('claims', 'Claims are gathered'), node('keys', 'The current key signs', { carryForward: undefined })]

test('d on a step asks Claude for a sub path, the pane says it is writing, and the reader lands in it', async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const nodes = { ...tour().nodes, persist: node('persist', 'Tokens persisted before reply', { dive: { question: 'What does persist sign?' } }) }
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour({ nodes, current: { nodeId: 'persist', depth: 0 } }) })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /◆ What does persist sign\?  d dives/ })).toBeDefined()
  expect(await ui.find({ key: 'key-surface' })).toBeUndefined()

  await ui.press({ key: 'key-dive' })
  expect(world.submitted).toHaveLength(1)
  expect(world.submitted[0]).toContain('Dive into step persist: What does persist sign?')
  expect(world.submitted[0]).toContain('{"path":"main","node":"persist"}')
  expect(await ui.find({ type: 'Text', text: /Claude is writing a sub path… keep reading/ })).toBeDefined()

  await ui.press({ key: 'key-dive' })
  expect(world.submitted).toHaveLength(1)

  const added = await $.tool.call({ tool: 'mcp__faro__tour_add_path', tourId: 'session-persistence', path: SIGNING, nodes: SIGNING_NODES })
  expect(added.deny).toBeUndefined()
  expect(String(added.result)).toContain('Sub path signing hangs from persist with 2 steps')

  expect(await ui.find({ type: 'Text', text: /^Session persistence › 2 › How a token is signed$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Claims are gathered' })).toBeDefined()
  expect((await ui.find({ key: 'node-signing-claims' }))?.text).toContain('▸')

  await ui.press({ key: 'key-next' })
  expect((await ui.find({ key: 'node-signing-keys' }))?.text).toContain('▸')

  await ui.press({ key: 'key-next' })
  expect(await ui.find({ type: 'Text', text: /^Session persistence$/ })).toBeDefined()
  expect((await ui.find({ key: 'node-persist' }))?.text).toContain('▸')
  expect(await ui.find({ type: 'Text', text: /↳ How a token is signed · 2 steps/ })).toBeDefined()

  // A written sub path is entered again without asking Claude.
  await ui.press({ key: 'key-dive' })
  expect(world.submitted).toHaveLength(1)
  expect((await ui.find({ key: 'node-signing-claims' }))?.text).toContain('▸')

  await ui.press({ key: 'key-surface' })
  expect((await ui.find({ key: 'node-persist' }))?.text).toContain('▸')
  await ui.unmount()
})

test('tour_add_path refuses a sub path hanging from no step, and keeps it with the tour', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })

  const refused = await $.tool.call({
    tool: 'mcp__faro__tour_add_path',
    tourId: 'session-persistence',
    path: { ...SIGNING, anchor: { path: 'main', node: 'ghost' } },
    nodes: SIGNING_NODES,
  })
  expect(refused.deny).toContain('anchor.node ghost is not a step of path main')

  await $.tool.call({ tool: 'mcp__faro__tour_add_path', tourId: 'session-persistence', path: SIGNING, nodes: SIGNING_NODES })
  const got = JSON.parse(String((await $.tool.call({ tool: 'mcp__faro__tour_get' })).result))
  expect(got.tour.subPaths.signing.steps).toEqual(['claims', 'keys'])
  // Nobody asked for it, so the reader stays where they were.
  expect(got.reader.current).toEqual({ nodeId: 'login', depth: 0 })
})

test('a click picks a code line, d dives from it and a asks about it; a second click lets it go', async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'line-3' })
  expect(await ui.find({ type: 'Text', text: '▸ L3 picked' })).toBeDefined()
  // The picked line is drawn on its own ground, the whole line clickable.
  const picked = (await ui.drawn()) as unknown
  expect(JSON.stringify(picked)).toContain('"backgroundColor":"#3a2f55"')

  await ui.press({ key: 'key-scrollDown' })
  expect(await ui.find({ type: 'Text', text: '▸ L4 picked' })).toBeDefined()

  await ui.press({ key: 'pick-ask' })
  expect(world.filled[0]).toContain('About src/login.ts:4 `line 4`')

  await ui.press({ key: 'line-4' })
  expect(await ui.find({ type: 'Text', text: /picked/ })).toBeUndefined()

  await ui.press({ key: 'line-7' })
  await ui.press({ key: 'key-dive' })
  expect(world.submitted[0]).toContain('Dive into line src/login.ts:7 `line 7` of step login')
  expect(world.submitted[0]).toContain('{"path":"main","node":"login","file":"src/login.ts","line":7}')
  expect(await ui.find({ type: 'Text', text: /writing a sub path from L7/ })).toBeDefined()

  await $.tool.call({
    tool: 'mcp__faro__tour_add_path',
    tourId: 'session-persistence',
    path: { ...SIGNING, id: 'line-seven', anchor: { path: 'main', node: 'login', file: 'src/login.ts', line: 7 } },
    nodes: SIGNING_NODES,
  })
  expect(await ui.find({ type: 'Text', text: /› 1 › How a token is signed$/ })).toBeDefined()

  await ui.press({ key: 'key-surface' })
  expect(await ui.find({ type: 'Text', text: ' ↳' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /from L7/ })).toBeDefined()
  await ui.unmount()
})

test('the rail is a tree of paths and m maps every path with the dives on offer', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const nodes = { ...tour().nodes, reload: node('reload', 'Restart reloads sessions', { dive: { question: 'What does reload replay?' } }) }
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour({ nodes }) })
  await $.tool.call({ tool: 'mcp__faro__tour_add_path', tourId: 'session-persistence', path: SIGNING, nodes: SIGNING_NODES })
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 110 }, surface: 'terminal' })

  expect((await ui.find({ type: 'Button', key: 'path-signing' }))?.text).toBe('↳ How a token is signed')
  expect(await ui.find({ key: 'node-signing-claims' })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'node-reload' }))?.text).toContain('◆')

  await ui.press({ key: 'path-signing' })
  expect((await ui.find({ type: 'Button', key: 'node-signing-claims' }))?.text).toContain('Claims are gathered')
  expect(await ui.find({ type: 'Text', text: /^▸    1 $/ })).toBeDefined()

  await ui.press({ key: 'key-map' })
  expect(await ui.find({ type: 'Text', text: 'Map of paths' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^├─┐ How a token is signed · 2 steps$/ })).toBeDefined()
  expect((await ui.find({ key: 'map-signing-claims' }))?.text).toBe('│ ├ ▸ 1 Claims are gathered')
  expect(await ui.find({ type: 'Text', text: /^├   3 Restart reloads sessions ◆$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^├┄┐ ◆ What does reload replay\?/ })).toBeDefined()

  await ui.press({ key: 'map-main-reload' })
  await ui.press({ key: 'key-map' })
  expect(await ui.find({ type: 'Text', text: /^Session persistence$/ })).toBeDefined()
  await ui.unmount()
})

test('a dive the answering turn ends without writing lets d ask again; a turn already running does not count', async ($, on) => {
  const world = engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const writing = { type: 'Text', text: /Claude is writing a sub path/ } as const

  await ui.press({ key: 'key-dive' })
  // The turn that was running when d was pressed ends: the dive still waits.
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, reason: 'answer', turnId: 'before' })
  expect(await ui.find(writing)).toBeDefined()

  await $.turn.start({ text: world.submitted[0] ?? '', turnId: 'dive' })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, reason: 'answer', turnId: 'sub', agentId: 'explore-1' })
  expect(await ui.find(writing)).toBeDefined()

  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, reason: 'aborted', turnId: 'dive' })
  expect(await ui.find(writing)).toBeUndefined()

  await ui.press({ key: 'key-dive' })
  expect(world.submitted).toHaveLength(2)
  await ui.unmount()
})
