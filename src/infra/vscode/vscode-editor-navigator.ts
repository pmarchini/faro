import type { Beacon, BeaconRange } from "../../core/model/document.ts";
import { createEditorNavigator } from "./editor-navigator.ts";
import type { RevealResult } from "./reveal-result.ts";
import type { VscodeLike } from "./vscode-api.ts";

type RevealTarget = {
  fileUri: string;
  range: BeaconRange;
};

type DecorationTypeLike = {
  dispose(): void;
};

type TextEditorLike = {
  revealRange(range: unknown, revealType: unknown): void | Promise<void>;
  setDecorations(decorationType: DecorationTypeLike, ranges: unknown[]): void | Promise<void>;
  setSelection?(selection: unknown): void | Promise<void>;
};

type EditorVscodeLike = {
  Uri: VscodeLike["Uri"];
  Position: new (line: number, character: number) => unknown;
  Range: new (start: { line: number; character: number }, end: { line: number; character: number }) => unknown;
  Selection?: new (
    anchor: { line: number; character: number },
    active: { line: number; character: number },
  ) => unknown;
  TextEditorRevealType: VscodeLike["TextEditorRevealType"];
  workspace: VscodeLike["workspace"];
  window: Pick<
    VscodeLike["window"],
    "createTextEditorDecorationType" | "showTextDocument"
  >;
};

type VscodeEditorNavigator = {
  revealBeacon(beacon: Beacon): Promise<RevealResult>;
  dispose(): void;
};

export function createVscodeEditorNavigator({
  vscode,
}: {
  vscode: EditorVscodeLike;
}): VscodeEditorNavigator {
  const decorationType = vscode.window.createTextEditorDecorationType();
  let activeEditor: TextEditorLike | null = null;

  const navigator = createEditorNavigator({
    async fileExists(fileUri) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.parse(fileUri));
        return true;
      } catch {
        return false;
      }
    },
    editor: {
      async revealTarget(target) {
        const uri = vscode.Uri.parse(target.fileUri);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = (await vscode.window.showTextDocument(document)) as TextEditorLike | null;

        if (!editor) {
          throw new UnsupportedEditorError();
        }

        if (activeEditor && activeEditor !== editor) {
          await activeEditor.setDecorations(decorationType, []);
        }

        const range = createRange(vscode, target);
        const selection = createSelection(vscode, range);

        await editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        await editor.setSelection?.(selection);

        activeEditor = editor;
      },
      async highlightTarget(target) {
        if (!activeEditor) {
          return;
        }

        await activeEditor.setDecorations(decorationType, [createRange(vscode, target)]);
      },
    },
  });

  return {
    async revealBeacon(beacon) {
      try {
        return await navigator.revealBeacon(beacon);
      } catch (error) {
        if (error instanceof UnsupportedEditorError) {
          return { status: "unsupported-editor" };
        }

        throw error;
      }
    },
    dispose() {
      if (activeEditor) {
        void activeEditor.setDecorations(decorationType, []);
        activeEditor = null;
      }

      decorationType.dispose();
    },
  };
}

function createRange(vscode: EditorVscodeLike, target: RevealTarget): unknown {
  const start = new vscode.Position(target.range.startLine - 1, target.range.startColumn - 1);
  const end = new vscode.Position(target.range.endLine - 1, target.range.endColumn - 1);
  return new (vscode.Range as new (...args: any[]) => unknown)(
    start as { line: number; character: number },
    end as { line: number; character: number },
  );
}

function createSelection(vscode: EditorVscodeLike, range: unknown): unknown {
  if (vscode.Selection) {
    const currentRange = range as { start: unknown };
    return new (vscode.Selection as new (...args: any[]) => unknown)(
      currentRange.start as { line: number; character: number },
      currentRange.start as { line: number; character: number },
    );
  }

  const currentRange = range as { start: unknown };

  return {
    anchor: currentRange.start,
    active: currentRange.start,
  };
}

class UnsupportedEditorError extends Error {}
