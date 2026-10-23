import type { Tour, TourNode, TourTarget } from '../src/core/model/tour.ts'
import { NODE_BUDGET, type ExplainRequest } from './explain-args.ts'

// The prompts the plugin hands Claude. Each names the skill and the tool to
// call, so the model's reply lands in the pane rather than only in chat.

const SKILL = 'faro-author-paths'

export function authoringPrompt(
  request: ExplainRequest,
  target: TourTarget,
  skillDir: string,
  notes: readonly string[] = [],
): string {
  const goal = request.goal ?? inferredGoal(target)

  return [
    `Use the ${SKILL} skill to author a Faro tour, then call mcp__faro__tour_upsert once with the whole tour.`,
    `Read ${skillDir}/comprehension.md and ${skillDir}/tour-schema.md first.`,
    '',
    `Target: kind "${target.kind}", ref ${JSON.stringify(target.ref)}${shaText(target)}.`,
    `Goal: ${goal}`,
    `Lens: ${request.lens} (write only this lens; leave otherLens empty).`,
    `Reader: ${request.reader}.`,
    `Depth: ${request.depth}, so ${NODE_BUDGET[request.depth]} nodes on the path${request.depth === 'brief' ? ', L0 and L1 only' : ''}.`,
    ...notes,
    '',
    'Copy the target object above into the tour as given. When the tool is done, reply in two or three lines: the goal, the shape of what you found, and that the pane is open to walk it.',
  ].join('\n')
}

export function askPrompt(tour: Tour, node: TourNode, question: string): string {
  return `[faro ${tour.id} › ${node.id} "${node.title}"] ${question}`
}

// Asks for a sub path under a step, or under one line of its code.
export function divePrompt(
  tour: Tour,
  pathId: string,
  node: TourNode,
  line?: { file: string; line: number; text: string },
): string {
  const where = line ? `line ${line.file}:${line.line} \`${line.text.trim()}\` of step ${node.id}` : `step ${node.id}`
  const question = line ? `How does this line work?` : (node.dive?.question ?? 'How does this step work inside?')
  const anchor = JSON.stringify({ path: pathId, node: node.id, ...(line ? { file: line.file, line: line.line } : {}) })

  return [
    `[faro ${tour.id} › ${node.id} "${node.title}"] Dive into ${where}: ${question}`,
    `Follow "Dives" in the ${SKILL} skill: call mcp__faro__tour_get, read the code under it, then write a sub path of 2 to 5 steps`,
    `with mcp__faro__tour_add_path, anchor ${anchor}. Keep your chat reply to one line.`,
  ].join(' ')
}

export function simplerPrompt(tour: Tour, node: TourNode): string {
  return [
    `[faro ${tour.id} › ${node.id} "${node.title}"] I don't get this step.`,
    `Call mcp__faro__tour_get to see where I am, then re-explain only node ${node.id} more simply`,
    'and write it back with mcp__faro__tour_update_node. Keep your chat reply to one or two lines.',
  ].join(' ')
}

export function otherLensPrompt(tour: Tour, node: TourNode): string {
  const other = tour.lens === 'flow' ? 'domain' : 'flow'

  return [
    `[faro ${tour.id} › ${node.id} "${node.title}"] Show this step in the ${other} lens.`,
    `Write node ${node.id}'s otherLens (summary, ${tour.target.kind === 'code' || tour.target.kind === 'question' ? 'whatItDoes' : 'whatChanged'}, why) in the ${other} lens`,
    'and save it with mcp__faro__tour_update_node, leaving every other field unchanged. No chat reply is needed beyond one line.',
  ].join(' ')
}

export function refreshPrompt(tour: Tour, node: TourNode): string {
  return [
    `[faro ${tour.id} › ${node.id} "${node.title}"] The files under this step changed since the tour was written.`,
    `Re-read its anchors and update node ${node.id} (ranges, beacons, text) with mcp__faro__tour_update_node.`,
  ].join(' ')
}

function inferredGoal(target: TourTarget): string {
  switch (target.kind) {
    case 'question':
      return target.ref
    case 'code':
      return `How does ${target.ref} work? Infer the question a reader of this code most needs answered.`
    default:
      return 'Infer it from the commit messages or PR description; if none states one, from the change itself.'
  }
}

function shaText(target: TourTarget): string {
  const parts = [target.baseSha && `baseSha ${target.baseSha}`, target.headSha && `headSha ${target.headSha}`]

  return parts.some(Boolean) ? `, ${parts.filter(Boolean).join(', ')}` : ''
}
