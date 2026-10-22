import type { EngineInterface } from 'claude-code'

import { PANE } from '../state.ts'

export function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: 'Faro tour' })
}

export function closePane($: EngineInterface) {
  return $.ui.close({ id: PANE })
}
