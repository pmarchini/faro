// Fails `tsc -p claude-code` when the state contract drifts from the core
// model: each pair must be assignable both ways. Imported by nothing.

import type { FaroDocumentV2, Tour, TourNode } from '../../src/core/model/tour.ts'
import type { FaroDocument, FaroTour, FaroTourNode } from './index.d.ts'

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

export const contractMatchesCore: [
  Same<FaroDocument, FaroDocumentV2>,
  Same<FaroTour, Tour>,
  Same<FaroTourNode, TourNode>,
] = [true, true, true]
