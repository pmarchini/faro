// The pane's key map. A Button hotkey is one lowercase letter or digit, so
// the design's enter, backspace, ? and ! become e, c, a and x.

export type PaneAction =
  | 'next'
  | 'previous'
  | 'deeper'
  | 'shallower'
  | 'lens'
  | 'beacon'
  | 'code'
  | 'ask'
  | 'dontGet'
  | 'refresh'
  | 'close'

export type PaneKey = { action: PaneAction; hotkey: string; label: string }

export const PANE_KEYS: readonly PaneKey[] = [
  { action: 'next', hotkey: 'j', label: 'next' },
  { action: 'previous', hotkey: 'k', label: 'back' },
  { action: 'deeper', hotkey: 'e', label: 'deeper' },
  { action: 'shallower', hotkey: 'c', label: 'less' },
  { action: 'lens', hotkey: 'l', label: 'lens' },
  { action: 'beacon', hotkey: 'b', label: 'beacon' },
  { action: 'code', hotkey: 'o', label: 'code' },
  { action: 'ask', hotkey: 'a', label: 'ask' },
  { action: 'dontGet', hotkey: 'x', label: "don't get it" },
  { action: 'refresh', hotkey: 'r', label: 'refresh' },
  { action: 'close', hotkey: 'q', label: 'close' },
]
