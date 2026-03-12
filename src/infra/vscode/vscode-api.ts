export type Disposable = {
  dispose(): void;
};

export type VscodeWebview = {
  html: string;
  options?: Record<string, unknown>;
  onDidReceiveMessage(
    listener: (message: unknown) => void | Promise<void>,
  ): Disposable;
};

export type VscodeWebviewView = {
  webview: VscodeWebview;
};

export type VscodeLike = {
  commands: {
    registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;
  };
  window: {
    registerTreeDataProvider(id: string, provider: unknown): Disposable;
    registerWebviewViewProvider(id: string, provider: unknown): Disposable;
    createTextEditorDecorationType(options?: Record<string, unknown>): Disposable;
    showTextDocument(document: unknown): Promise<{
      revealRange(range: unknown, revealType?: unknown): void | Promise<void>;
      setDecorations(decorationType: Disposable, ranges: unknown[]): void | Promise<void>;
      selection?: unknown;
      setSelection?(selection: unknown): void | Promise<void>;
    } | null>;
  };
  workspace: {
    fs: {
      stat(uri: unknown): Promise<unknown>;
    };
    openTextDocument(uri: unknown): Promise<unknown>;
  };
  Uri: {
    parse(value: string): unknown;
  };
  Position: new (...args: any[]) => unknown;
  Range: new (...args: any[]) => unknown;
  Selection: new (...args: any[]) => unknown;
  TextEditorRevealType: {
    InCenterIfOutsideViewport: unknown;
  };
};

export async function loadVscodeApi(): Promise<VscodeLike> {
  return (await import("vscode")) as unknown as VscodeLike;
}
