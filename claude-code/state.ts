import { createEmptyTourDocument } from '../src/core/model/tour.ts'
import type { FaroReader } from './types'

// Shared names and initial values. The atoms themselves are declared in each
// file that reads or writes them: the plugin scanner reads a state reference
// only from a const of the file that uses it.

export const PANE = 'faro-tour'
export const PINNED_KEY = 'pinned-tours'

export const EMPTY_DOCUMENT = createEmptyTourDocument()

export const EMPTY_READER: FaroReader = {
  visited: {},
  confused: {},
  stale: {},
  isOtherLensShown: false,
  isFileTreeHidden: false,
  beaconIndex: 0,
  isCodeToggled: false,
  isStepListShown: false,
}

export function addOnce(list: readonly string[] | undefined, id: string): string[] {
  return list?.includes(id) ? [...list] : [...(list ?? []), id]
}
