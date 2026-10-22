import type {
  DecorationRenderOptions,
  TextEditorDecorationType,
} from "vscode";

export type Disposable = {
  dispose(): void;
};

export type VscodeDecorationRenderOptions = Pick<
  DecorationRenderOptions,
  "isWholeLine" | "backgroundColor" | "after"
>;

export type VscodeTextEditorDecorationType = Pick<
  TextEditorDecorationType,
  "dispose"
>;

export type VscodeStatusBarItem = {
  text: string;
  tooltip?: string;
  command?: string;
  show(): void;
  dispose(): void;
};

export type VscodeComment = {
  body: unknown;
  mode: unknown;
  author: { name: string };
};

export type VscodeCommentThread = {
  canReply: boolean;
  label?: string;
  collapsibleState: unknown;
  dispose(): void;
};

export type VscodeCommentController = {
  createCommentThread(uri: unknown, range: unknown, comments: VscodeComment[]): VscodeCommentThread;
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
    executeCommand(id: string, ...args: unknown[]): unknown;
  };
  window: {
    registerTreeDataProvider(id: string, provider: unknown): Disposable;
    registerWebviewViewProvider(id: string, provider: unknown): Disposable;
    createTextEditorDecorationType(
      options?: VscodeDecorationRenderOptions,
    ): VscodeTextEditorDecorationType;
    createStatusBarItem?(alignment?: unknown, priority?: number): VscodeStatusBarItem;
    visibleTextEditors?: ReadonlyArray<{ document?: { uri: unknown } }>;
    showTextDocument(
      document: unknown,
      options?: { preserveFocus?: boolean; preview?: boolean },
    ): Promise<{
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
  comments?: {
    createCommentController(id: string, label: string): VscodeCommentController;
  };
  MarkdownString?: new (value?: string) => unknown;
  CommentMode?: { Preview: unknown };
  CommentThreadCollapsibleState?: { Expanded: unknown; Collapsed: unknown };
  StatusBarAlignment?: { Left: unknown };
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
