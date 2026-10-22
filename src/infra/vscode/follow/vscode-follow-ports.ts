import { unwatchFile, watchFile } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { VscodeLike, VscodeTextEditorDecorationType } from "../vscode-api.ts";
import type { FollowPorts, FollowView } from "./claude-code-follower.ts";

type FollowEditor = {
  revealRange(range: unknown, revealType?: unknown): void | Promise<void>;
  setDecorations(decorationType: VscodeTextEditorDecorationType, ranges: unknown[]): void | Promise<void>;
};

// The VS Code side of following: polling the signal file (fs.watch misses
// a file that does not exist yet), a preview editor that leaves focus in the
// terminal, two highlights and a status bar item.
export function createVscodeFollowPorts({ vscode }: { vscode: VscodeLike }): FollowPorts {
  const anchorDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 208, 0, 0.08)",
  });
  const focusDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 208, 0, 0.22)",
  });
  const statusItem = vscode.window.createStatusBarItem?.();
  let editor: FollowEditor | null = null;

  function clearEditor(): void {
    if (editor) {
      void editor.setDecorations(anchorDecoration, []);
      void editor.setDecorations(focusDecoration, []);
      editor = null;
    }
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
    async readText(filePath) {
      try {
        return await readFile(filePath, "utf8");
      } catch {
        return null;
      }
    },
    isEnabled() {
      return vscode.workspace.getConfiguration("faro").get("followClaudeCode", true);
    },
    async show(view: FollowView) {
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(pathToFileURL(view.filePath).href),
      );
      const next = (await vscode.window.showTextDocument(document, {
        preserveFocus: true,
        preview: true,
      })) as FollowEditor | null;

      if (!next) {
        return;
      }

      if (editor !== next) {
        clearEditor();
      }

      const focus = lineRange(vscode, view.focusLine, view.focusLine);

      await next.setDecorations(
        anchorDecoration,
        view.lines.map((line) => lineRange(vscode, line.startLine, line.endLine)),
      );
      await next.setDecorations(focusDecoration, [focus]);
      await next.revealRange(focus, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      editor = next;

      if (statusItem) {
        statusItem.text = `$(eye) ${view.status}`;
        statusItem.tooltip = view.tooltip;
        statusItem.show();
      }
    },
    dispose() {
      clearEditor();
      anchorDecoration.dispose();
      focusDecoration.dispose();
      statusItem?.dispose();
    },
  };
}

function lineRange(vscode: VscodeLike, startLine: number, endLine: number): unknown {
  return new vscode.Range(new vscode.Position(startLine - 1, 0), new vscode.Position(endLine - 1, 0));
}
