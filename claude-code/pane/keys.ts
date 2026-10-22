// The pane's key map. A Button hotkey is one lowercase letter or digit, so
// the design's enter, backspace, ? and ! become e, u, a and x. `c` shows or
// folds the code panel, as in the paired design; `t` is the file tree, or
// the step list in the short layout.

export type PaneAction =
  | 'next'
  | 'previous'
  | 'deeper'
  | 'shallower'
  | 'lens'
  | 'beacon'
  | 'code'
  | 'codePanel'
  | 'ask'
  | 'dontGet'
  | 'refresh'
  | 'files'
  | 'steps'
  | 'close'

export type PaneKey = { action: PaneAction; hotkey: string; label: string }

export const PANE_KEYS: readonly PaneKey[] = [
  { action: 'next', hotkey: 'j', label: 'next' },
  { action: 'previous', hotkey: 'k', label: 'back' },
  { action: 'deeper', hotkey: 'e', label: 'deeper' },
  { action: 'shallower', hotkey: 'u', label: 'less' },
  { action: 'lens', hotkey: 'l', label: 'lens' },
  { action: 'beacon', hotkey: 'b', label: 'beacon' },
  { action: 'code', hotkey: 'o', label: 'focus' },
  { action: 'codePanel', hotkey: 'c', label: 'code' },
  { action: 'ask', hotkey: 'a', label: 'ask' },
  { action: 'dontGet', hotkey: 'x', label: "don't get it" },
  { action: 'refresh', hotkey: 'r', label: 'refresh' },
  { action: 'files', hotkey: 't', label: 'files' },
  { action: 'steps', hotkey: 't', label: 'steps' },
  { action: 'close', hotkey: 'q', label: 'close' },
]
