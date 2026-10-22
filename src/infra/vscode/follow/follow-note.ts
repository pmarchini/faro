import type { FollowSignal } from "../../../core/model/follow.ts";

// The step's details as Markdown, in the order the pane shows them: what to
// look at first, then why, then what to carry to the next step. The editor
// renders it untrusted, so model text cannot run commands or raw HTML.
export function renderFollowNote(signal: FollowSignal): string {
  const note = signal.note;
  const plan = note?.plan ? ` · _${note.plan}_` : "";
  const lines = [`**${signal.step}/${signal.total} · ${signal.title}**${plan}`, "", signal.summary];
  const add = (label: string, value: string | undefined) => {
    if (value) {
      lines.push("", `**${label}:** ${value}`);
    }
  };

  if (note?.surprise) {
    lines.push("", `> **Surprise:** ${note.surprise}`);
  }

  add("Confirms", note?.confirms);
  add("What changed", note?.whatChanged);
  add("What it does", note?.whatItDoes);

  if (note?.why) {
    const source = note.why.source === "inferred" ? "inferred" : `from the ${note.why.source}`;
    lines.push("", `**Why:** ${note.why.text} _(${source})_`);
  }

  if (note?.beacon) {
    lines.push("", `**Look at:** \`${note.beacon.label.replaceAll("`", "'")}\`, line ${note.beacon.line}`);
  }

  add("Carry forward", note?.carryForward);
  add("Detail", note?.detail);
  lines.push("", `_${signal.tourTitle}${note ? ` · ${note.lens} lens` : ""} · following Claude Code_`);

  return lines.join("\n");
}
