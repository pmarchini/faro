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
    beacons: [{ label: `${id}()`, file: `src/${id}.ts`, line: 5 }],
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
  const written: Record<string, string> = {}
  const mtimes: Record<string, number> = {}
  // A file another process (the VS Code extension) writes.
  const external = (path: string, text: string) => {
    written[path] = text
    mtimes[path] = (mtimes[path] ?? 0) + 1
  }

  mock.store(on)
  on('tool.register', (_, e) => ({ value: { tool: `mcp__faro__${e.name}` } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  // Like the engine's, a relative path would resolve against Claude Code's
  // own folder, so only paths under the session's folder are found.
  on('fs.read', (_, e) => {
    if (e.path.startsWith('/repo/.faro/')) return { value: written[e.path] ?? '' }
    if (e.path.startsWith('/repo/')) return { value: SOURCE }
    throw new Error(`no such file: ${e.path}`)
  })
  on('fs.write', (_, e) => {
    external(e.path, e.text)
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: '/repo' }))
  on('fs.exists', (_, e) => ({ value: e.path in written }))
  on('fs.stat', (_, e) => {
    if (e.path.includes('src/')) return { value: { kind: 'dir', isLink: false, size: 0, mtimeMs: 0 } }
    if (e.path in written) return { value: { kind: 'file', isLink: false, size: 1, mtimeMs: mtimes[e.path] ?? 0 } }
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

  return { submitted, filled, written, external }
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
  expect(await ui.find({ type: 'Text', text: /^ 5   line 5$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / ◀ 1$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^● 1 L5  login\(\)$/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Code' })).map((found) => found.text).join('\n')).toContain('line 10')

  await ui.press({ key: 'key-code' })
  expect(await ui.find({ type: 'Text', text: /whole file · 30 lines/ })).toBeDefined()
  await ui.unmount()
})

test('lines far from a beacon fold, z unfolds them, and n scrolls a long file', async ($, on) => {
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

  expect(await ui.find({ type: 'Text', text: /10 lines folded · z unfolds/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /11 lines folded/ })).toBeDefined()

  await ui.press({ key: 'key-unfold' })
  expect(await ui.find({ type: 'Text', text: /lines folded/ })).toBeUndefined()
  const before = (await ui.find({ type: 'Text', text: /\d+ above, \d+ below/ }))?.text
  expect(before).toBeDefined()

  await ui.press({ key: 'key-scrollDown' })
  const after = (await ui.find({ type: 'Text', text: /\d+ above, \d+ below/ }))?.text
  expect(after).not.toBe(before)
  expect(await ui.find({ type: 'Text', text: '◆' })).toBeDefined()
  await ui.unmount()
})

test('the files section shows where the current step sits and f hides it', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^src\/  ▸ login\.ts  · persist\.ts/ })).toBeDefined()

  await ui.press({ key: 'key-next' })
  expect(await ui.find({ type: 'Text', text: /^src\/  ✓ login\.ts  ▸ persist\.ts/ })).toBeDefined()

  await ui.press({ key: 'key-files' })
  expect(await ui.find({ type: 'Text', text: /▸ persist\.ts/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /FILES  \(f shows\)/ })).toBeDefined()
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

test('a wide pane puts the logo, steps and files in a rail beside the reader, and f hides it', async ($, on) => {
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
  expect(await ui.find({ type: 'Text', text: /FILES  \(f shows\)/ })).toBeDefined()
  await ui.unmount()
})

test('each step is written for VS Code to follow, until /tour follow off', async ($, on) => {
  const world = engine(on)
  mock.clock(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })

  const first = JSON.parse(world.written['/repo/.faro/follow.json'] ?? '{}')
  expect(first).toMatchObject({ version: 1, root: '/repo', nodeId: 'login', step: 1, total: 3 })
  expect(first.focus).toEqual({ file: 'src/login.ts', line: 5 })
  expect(world.written['/repo/.faro/.gitignore']).toBe('*\n')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'key-next' })
  expect(JSON.parse(world.written['/repo/.faro/follow.json'] ?? '{}').nodeId).toBe('persist')

  expect((await $.command.run({ ...TYPED, command: 'tour', args: 'follow off' })).text).toContain('does not follow')
  await ui.press({ key: 'key-next' })
  expect(JSON.parse(world.written['/repo/.faro/follow.json'] ?? '{}').nodeId).toBe('persist')
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

test('a VS Code heartbeat pairs the pane: the code folds to one line and c opens it', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await clock.advance(400)

  expect(await ui.find({ type: 'Code' })).toBeDefined()

  world.external('/repo/.faro/ack.json', '{}')
  await clock.advance(400)
  expect(await ui.find({ type: 'Text', text: /⇄ VS Code/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⇄ Code in VS Code  src\/login\.ts L5/ })).toBeDefined()
  expect(await ui.find({ type: 'Code' })).toBeUndefined()

  await ui.press({ key: 'key-codePanel' })
  expect(await ui.find({ type: 'Code' })).toBeDefined()

  // No beat for longer than the extension's interval allows: solo again.
  await clock.advance(13_000)
  expect(await ui.find({ type: 'Text', text: /⇄ VS Code/ })).toBeUndefined()
  await ui.unmount()
})

test('VS Code moves the tour through control.json, and only for the active tour', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__faro__tour_upsert', tour: tour() })
  await clock.advance(400)
  const step = () => JSON.parse(world.written['/repo/.faro/follow.json'] ?? '{}').nodeId

  world.external('/repo/.faro/control.json', JSON.stringify({ version: 1, id: '1', tourId: 'session-persistence', action: 'next' }))
  await clock.advance(400)
  expect(step()).toBe('persist')

  world.external('/repo/.faro/control.json', JSON.stringify({ version: 1, id: '2', tourId: 'other', action: 'next' }))
  await clock.advance(400)
  expect(step()).toBe('persist')

  world.external('/repo/.faro/control.json', JSON.stringify({ version: 1, id: '3', tourId: 'session-persistence', action: 'step', nodeId: 'login' }))
  await clock.advance(400)
  expect(step()).toBe('login')
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
  expect(await ui.find({ type: 'Text', text: /^  \[code tour\]$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /L1–10 · 10 lines · read only/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Carry on$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\[role: guard clause\]$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /inferred: no commit says so/ })).toBeDefined()
  expect(JSON.parse(world.written['/repo/.faro/follow.json'] ?? '{}').diffBase).toBeUndefined()
  await ui.unmount()
})
