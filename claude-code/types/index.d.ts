// The faro mod's state contract. A contract must be self-contained, so the
// tour types are restated here; test/claude-code/contract.test.ts fails the
// type-check when they drift from src/core/model/tour.ts.

export type FaroTourWhy = { text: string; source: 'commit' | 'pr' | 'comment' | 'inferred' }

export type FaroTourNode = {
  id: string
  title: string
  plan: string
  summary: string
  confirms?: string
  whatChanged?: string
  whatItDoes?: string
  why?: FaroTourWhy
  beacons: { label: string; file: string; line: number; note?: string }[]
  carryForward?: string
  detail?: string
  suggestedQuestion?: string
  surprise?: string
  anchors: {
    file: string
    range: { startLine: number; endLine: number; startColumn?: number; endColumn?: number }
    hunk?: { oldStart: number; newStart: number }
  }[]
  role: 'path' | 'supporting'
  otherLens?: { summary: string; whatChanged?: string; whatItDoes?: string; why?: FaroTourWhy }
}

export type FaroTour = {
  id: string
  title: string
  target: {
    kind: 'worktree' | 'range' | 'branch' | 'pr' | 'code' | 'question'
    ref: string
    baseSha?: string
    headSha?: string
  }
  goal: string
  hypothesis: string
  lens: 'flow' | 'domain'
  reader: 'new' | 'familiar'
  nodes: Record<string, FaroTourNode>
  edges: { from: string; to: string; kind: 'calls' | 'data' | 'requires' | 'tests' | 'configures'; label?: string }[]
  path: string[]
  current: { nodeId: string | null; depth: 0 | 1 | 2 }
}

export type FaroDocument = {
  schemaVersion: 2
  activeTourId: string | null
  tours: FaroTour[]
}

// What the reader has done in each tour, kept beside the document so a
// rewrite of the tour does not lose it.
export type FaroReader = {
  visited: Record<string, string[]>
  confused: Record<string, string[]>
  stale: Record<string, string[]>
  isOtherLensShown: boolean
  // `f` hides the rail of steps and files.
  isFileTreeHidden: boolean
  beaconIndex: number
  // `c` flips the code panel from its default: open, or one line in a
  // short pane.
  isCodeToggled: boolean
  // In the short layout `t` shows the step list instead of the file tree.
  isStepListShown: boolean
  // The code panel: rows scrolled away from the current beacon, and whether
  // `f` folded the lines far from every beacon (the code starts unfolded).
  codeOffset: number
  isCodeFolded: boolean
  // Whether the pane was open, so a resumed session opens it again.
  isPaneOpen: boolean
}

export type FaroDrafting = {
  label: string
  detail: string
}

// One line of the code panel: its number in the file (null for a line a
// diff removed), its diff marker, and its text.
export type FaroCodeRow = {
  number: number | null
  marker: ' ' | '+' | '-'
  text: string
}

// The code panel's lines for the current beacon's anchor: its diff hunks
// for a change, its lines for existing code, or the whole file after `o`.
export type FaroCodeView = {
  tourId: string
  nodeId: string
  isWholeFile: boolean
  path: string
  heading: string
  format: 'source' | 'diff'
  rows: FaroCodeRow[]
}

declare module 'claude-code' {
  interface PluginState {
    faro: {
      document: FaroDocument
      reader: FaroReader
      drafting: FaroDrafting | null
      code: FaroCodeView | null
    }
  }
}
