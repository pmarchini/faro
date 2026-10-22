import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import { EMPTY_DOCUMENT, EMPTY_READER } from './state.ts'

const documentAtom = atom({ plugin: 'faro', key: 'document' } as const, EMPTY_DOCUMENT)
const readerAtom = atom({ plugin: 'faro', key: 'reader' } as const, EMPTY_READER)

// After an edit lands, marks the nodes of open tours whose anchors sit in
// the edited file, so the pane can say the explanation may be out of date.

const EDITING_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit)$/

export function watchEdits(on: On): void {
  on('tool.call', { tool: EDITING_TOOLS }, async ($, e, next) => {
    const ran = await next(e)
    const filePath = (e as { file_path?: unknown; notebook_path?: unknown }).file_path ??
      (e as { notebook_path?: unknown }).notebook_path

    if (ran.deny !== undefined || ran.isError === true || typeof filePath !== 'string') {
      return ran
    }

    const document = await read($, documentAtom)
    const touched: Record<string, string[]> = {}

    for (const tour of document.tours) {
      const ids = Object.values(tour.nodes)
        .filter((node) => node.anchors.some((anchor) => isSameFile(filePath, anchor.file)))
        .map((node) => node.id)

      if (ids.length > 0) touched[tour.id] = ids
    }

    if (Object.keys(touched).length > 0) {
      await update($, readerAtom, (reader) => {
        const stale = { ...reader.stale }

        for (const [tourId, ids] of Object.entries(touched)) {
          stale[tourId] = [...new Set([...(stale[tourId] ?? []), ...ids])]
        }

        return { ...reader, stale }
      })
    }

    return ran
  }).catch(($, e, next) => next(e))
}

function isSameFile(editedPath: string, anchorFile: string): boolean {
  const relative = anchorFile.replace(/^\.\//, '')

  return editedPath === relative || editedPath.endsWith(`/${relative}`)
}
