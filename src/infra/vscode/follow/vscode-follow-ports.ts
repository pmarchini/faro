import { unwatchFile, watchFile } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { VscodeCommentThread, VscodeLike, VscodeTextEditorDecorationType } from "../vscode-api.ts";
import type { FollowPorts, FollowView } from "./claude-code-follower.ts";

type FollowEditor = {
  document?: { uri: { toString(): string } };
  revealRange(range: unknown, revealType?: unknown): void | Promise<void>;
  setDecorations(decorationType: VscodeTextEditorDecorationType, ranges: unknown[]): void | Promise<void>;
};

const LABEL_LIMIT = 60;

// The VS Code side of following: polling the signal file (fs.watch misses
// a file that does not exist yet), one preview tab that never takes focus
// (a diff against the tour's base for a diff tour), the step's ranges and
// beacons highlighted with each beacon's one-liner at the end of its line,
// and a collapsed note naming the step.
export function createVscodeFollowPorts({ vscode }: { vscode: VscodeLike }): FollowPorts {
  const anchorDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 208, 0, 0.06)",
  });
  const beaconDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 208, 0, 0.12)",
    after: { margin: "0 0 0 2em", color: "rgba(160, 160, 160, 0.7)" },
  });
  const focusDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 208, 0, 0.24)",
    after: { margin: "0 0 0 2em", color: "rgba(255, 208, 0, 0.85)" },
  });
  const decorations = [anchorDecoration, beaconDecoration, focusDecoration];
  // A controller with no commenting ranges: people cannot add to it, so the
  // only thread on the code is Faro's read-only note.
  const notes = vscode.comments?.createCommentController("faro.follow", "Faro");
  let editor: FollowEditor | null = null;
  let thread: VscodeCommentThread | null = null;

  function clearEditor(): void {
    for (const decoration of decorations) {
      void editor?.setDecorations(decoration, []);
    }

    editor = null;
  }

  function clearNote(): void {
    thread?.dispose();
    thread = null;
  }

  function showNote(uri: unknown, line: unknown, view: FollowView): void {
    clearNote();

    if (!notes || !vscode.MarkdownString || !isNotesOn(vscode)) {
      return;
    }

    thread = notes.createCommentThread(uri, line, [
      {
        body: new vscode.MarkdownString(view.note),
        mode: vscode.CommentMode?.Preview,
        author: { name: "Faro" },
      },
    ]);
    thread.canReply = false;
    thread.label = view.noteLabel;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState?.Collapsed;
  }

  async function open(view: FollowView, uri: unknown): Promise<FollowEditor | null> {
    if (view.diffBase && vscode.window.visibleTextEditors) {
      const base = vscode.Uri.parse(gitUri(view.filePath, view.diffBase));
      const title = `${path.basename(view.filePath)} ↔ ${view.diffBase} (${view.status})`;

      try {
        await vscode.commands.executeCommand("vscode.diff", base, uri, title, { preserveFocus: true, preview: true });
        const shown = String(uri);
        const diffEditor = vscode.window.visibleTextEditors.find((candidate) => String(candidate.document?.uri) === shown);

        if (diffEditor) {
          return diffEditor as FollowEditor;
        }
      } catch {
        // No git extension, or the base is unknown to it: show the plain file.
      }
    }

    const document = await vscode.workspace.openTextDocument(uri);
    return (await vscode.window.showTextDocument(document, { preserveFocus: true, preview: true })) as FollowEditor | null;
  }

  return {
    watch(filePath, onChange) {
      const listener = (current: { mtimeMs: number }, previous: { mtimeMs: number }) => {
        if (current.mtimeMs !== previous.mtimeMs) {
          onChange();
        }
      };

      watchFile(filePath, { interval: 300, persistent: false }, listener);

      return {
        dispose() {
          unwatchFile(filePath, listener);
        },
      };
    },
    every(ms, tick) {
      const timer = setInterval(tick, ms);
      timer.unref?.();

      return {
        dispose() {
          clearInterval(timer);
        },
      };
    },
    async readText(filePath) {
      try {
        return await readFile(filePath, "utf8");
      } catch {
        return null;
      }
    },
    async writeText(filePath, text) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, text, "utf8");
    },
    now: () => Date.now(),
    isEnabled() {
      return vscode.workspace.getConfiguration("faro").get("followClaudeCode", true);
    },
    async show(view: FollowView) {
      const uri = vscode.Uri.parse(pathToFileURL(view.filePath).href);
      const next = await open(view, uri);

      if (!next) {
        return;
      }

      if (editor !== next) {
        clearEditor();
      }

      const focus = lineRange(vscode, view.focusLine, view.focusLine);
      const marks = (isCurrent: boolean) =>
        view.beacons
          .filter((beacon) => beacon.isCurrent === isCurrent)
          .map((beacon) => ({
            range: lineRange(vscode, beacon.line, beacon.line),
            hoverMessage: beacon.label,
            renderOptions: { after: { contentText: `◂ ${shorten(beacon.label)}` } },
          }));
      const current = marks(true);

      await next.setDecorations(
        anchorDecoration,
        view.lines.map((line) => lineRange(vscode, line.startLine, line.endLine)),
      );
      await next.setDecorations(beaconDecoration, marks(false));
      await next.setDecorations(focusDecoration, current.length > 0 ? current : [{ range: focus }]);
      await next.revealRange(focus, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      showNote(uri, focus, view);
      editor = next;
    },
    dispose() {
      clearEditor();
      clearNote();
      notes?.dispose();

      for (const decoration of decorations) {
        decoration.dispose();
      }
    },
  };
}

// The URI the built-in git extension serves a file at a ref from.
export function gitUri(filePath: string, ref: string): string {
  return `git:${pathToFileURL(filePath).pathname}?${encodeURIComponent(JSON.stringify({ path: filePath, ref }))}`;
}

function shorten(label: string): string {
  return label.length > LABEL_LIMIT ? `${label.slice(0, LABEL_LIMIT - 1)}…` : label;
}

function isNotesOn(vscode: VscodeLike): boolean {
  return vscode.workspace.getConfiguration("faro").get("followClaudeCode.notes", true);
}

function lineRange(vscode: VscodeLike, startLine: number, endLine: number): unknown {
  return new vscode.Range(new vscode.Position(startLine - 1, 0), new vscode.Position(endLine - 1, 0));
}
