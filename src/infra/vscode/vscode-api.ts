import type {
  DecorationRenderOptions,
  TextEditorDecorationType,
} from "vscode";

export type Disposable = {
  dispose(): void;
};

export type VscodeDecorationRenderOptions = Pick<
  DecorationRenderOptions,
  "isWholeLine" | "backgroundColor"
>;

export type VscodeTextEditorDecorationType = Pick<
  TextEditorDecorationType,
  "dispose"
>;

export type VscodeWebview = {
  html: string;
  options?: Record<string, unknown>;
  asWebviewUri?(resource: unknown): { toString(): string };
  resolveWebviewUri?(path: string): string;
  setLocalResourceRoots?(paths: string[]): void;
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
    executeCommand(id: string, ...args: unknown[]): unknown;
  };
  window: {
    registerTreeDataProvider(id: string, provider: unknown): Disposable;
    registerWebviewViewProvider(id: string, provider: unknown): Disposable;
    createTextEditorDecorationType(
      options?: VscodeDecorationRenderOptions,
    ): VscodeTextEditorDecorationType;
    showTextDocument(document: unknown): Promise<{
      revealRange(range: unknown, revealType?: unknown): void | Promise<void>;
      setDecorations(decorationType: Disposable, ranges: unknown[]): void | Promise<void>;
      selection?: unknown;
      setSelection?(selection: unknown): void | Promise<void>;
    } | null>;
  };
  workspace: {
    workspaceFolders?: Array<{
      uri: {
        toString(): string;
      };
    }>;
    fs: {
      stat(uri: unknown): Promise<unknown>;
    };
    openTextDocument(uri: unknown): Promise<unknown>;
    getConfiguration(section: string): {
      get<T>(key: string, defaultValue: T): T;
    };
  };
  lm: {
    registerMcpServerDefinitionProvider(id: string, provider: unknown): Disposable;
  };
  McpStdioServerDefinition: new (
    label: string,
    command: string,
    args?: string[],
    env?: Record<string, string | number | null>,
    version?: string,
  ) => unknown;
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
