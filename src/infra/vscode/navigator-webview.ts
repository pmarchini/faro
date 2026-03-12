import type { NavigatorViewModel } from "../../app/views/navigator-view-model.ts";

type NavigatorMessage =
  | { type: "navigator.previous" }
  | { type: "navigator.next" }
  | { type: "navigator.reveal" }
  | { type: string };

type Disposable = {
  dispose(): void;
};

type WebviewLike = {
  html: string;
  onDidReceiveMessage(
    listener: (message: NavigatorMessage) => void | Promise<void>,
  ): Disposable;
};

type NavigatorWebviewDependencies = {
  webview: WebviewLike;
  getViewModel(): NavigatorViewModel;
  onPrevious(): Promise<void>;
  onNext(): Promise<void>;
  onReveal(): Promise<void>;
};

type NavigatorWebviewAdapter = Disposable & {
  render(): void;
};

export function createNavigatorWebviewAdapter({
  webview,
  getViewModel,
  onPrevious,
  onNext,
  onReveal,
}: NavigatorWebviewDependencies): NavigatorWebviewAdapter {
  const subscription = webview.onDidReceiveMessage(async (message) => {
    if (message.type === "navigator.previous") {
      await onPrevious();
      render();
      return;
    }

    if (message.type === "navigator.next") {
      await onNext();
      render();
      return;
    }

    if (message.type === "navigator.reveal") {
      await onReveal();
      render();
    }
  });

  function render(): void {
    webview.html = renderNavigatorHtml(getViewModel());
  }

  return {
    render,
    dispose() {
      subscription.dispose();
    },
  };
}

export function renderNavigatorHtml(viewModel: NavigatorViewModel): string {
  if (viewModel.state === "empty") {
    return renderLayout({
      title: viewModel.title,
      body: `<p>${escapeHtml(viewModel.message)}</p>`,
      position: "",
      canGoPrevious: false,
      canGoNext: false,
    });
  }

  const tags =
    viewModel.tags.length === 0
      ? ""
      : `<ul>${viewModel.tags
          .map((tag) => `<li>${escapeHtml(tag)}</li>`)
          .join("")}</ul>`;

  return renderLayout({
    title: `${viewModel.pathTitle} / ${viewModel.beaconTitle}`,
    body: `
      <p>${escapeHtml(viewModel.summary)}</p>
      <p>${escapeHtml(viewModel.explanation)}</p>
      ${tags}
    `,
    position: viewModel.positionLabel,
    canGoPrevious: viewModel.canGoPrevious,
    canGoNext: viewModel.canGoNext,
  });
}

function renderLayout({
  title,
  body,
  position,
  canGoPrevious,
  canGoNext,
}: {
  title: string;
  body: string;
  position: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
}): string {
  return `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>${escapeHtml(title)}</h1>
          <div>${body}</div>
          <p>${escapeHtml(position)}</p>
          <button ${canGoPrevious ? "" : "disabled"} data-action="previous">Prev</button>
          <button data-action="reveal">Reveal</button>
          <button ${canGoNext ? "" : "disabled"} data-action="next">Next</button>
        </main>
        <script>
          const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
          document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
              return;
            }

            const action = target.dataset.action;
            if (!action || !vscode) {
              return;
            }

            vscode.postMessage({ type: "navigator." + action });
          });
        </script>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
