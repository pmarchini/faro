import type { FollowSignal } from "../../../core/model/follow.ts";

// The note pinned under the beacon line. The story stays in the Claude Code
// pane, so VS Code shows only the step's headline and plan, and where the
// rest is. The editor renders it untrusted: model text cannot run commands
// or raw HTML.
export function renderFollowNote(signal: FollowSignal): string {
  const plan = signal.note?.plan ? `_${signal.note.plan}_ · ` : "";

  return `**${signal.step}/${signal.total} · ${signal.title}**\n\n${plan}full story in Claude Code`;
}
