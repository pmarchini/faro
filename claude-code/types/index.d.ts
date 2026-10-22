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
  beacons: { label: string; file: string; line: number }[]
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
  beaconIndex: number
}

export type FaroDrafting = {
  label: string
  detail: string
}

// The code under the node panel: beacon lines with a little context, or the
// whole anchor (or its hunk) after `o`.
export type FaroCodeView = {
  tourId: string
  nodeId: string
  isFull: boolean
  heading: string
  source: string
  format: 'source' | 'diff'
  startLine?: number
  path?: string
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
