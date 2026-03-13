import type { NavigatorViewModel } from "../../app/views/navigator-view-model.ts";

const ACTIVE_BEACON_BUTTON_BACKGROUND = "#0b57d0";
const INACTIVE_BEACON_BUTTON_BACKGROUND = "#2f3640";
const BEACON_BUTTON_TEXT_COLOR = "#ffffff";

type NavigatorMessage =
  | { type: "navigator.previous" }
  | { type: "navigator.next" }
  | { type: "navigator.reveal" }
  | { type: "navigator.selectBeacon"; pathId: string; beaconId: string }
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
  onSelectBeacon(pathId: string, beaconId: string): Promise<void>;
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
  onSelectBeacon,
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
      return;
    }

    if (
      isSelectBeaconMessage(message)
    ) {
      await onSelectBeacon(message.pathId, message.beaconId);
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
      beaconList: "",
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
    beaconList: renderBeaconList(viewModel),
  });
}

function renderLayout({
  title,
  body,
  position,
  canGoPrevious,
  canGoNext,
  beaconList,
}: {
  title: string;
  body: string;
  position: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  beaconList: string;
}): string {
  return `
    <!doctype html>
    <html lang="en">
      <body>
        <main style="height: 100vh; display: flex; flex-direction: column; min-height: 0;">
          <h1>${escapeHtml(title)}</h1>
          <div>${body}</div>
          <p>${escapeHtml(position)}</p>
          <section>
            <button ${canGoPrevious ? "" : "disabled"} data-action="previous">Prev</button>
            <button data-action="reveal">Reveal</button>
            <button ${canGoNext ? "" : "disabled"} data-action="next">Next</button>
          </section>
          ${beaconList}
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

            if (action === "select-beacon") {
              const pathId = target.dataset.pathId;
              const beaconId = target.dataset.beaconId;

              if (!pathId || !beaconId) {
                return;
              }

              vscode.postMessage({ type: "navigator.selectBeacon", pathId, beaconId });
              return;
            }

            vscode.postMessage({ type: "navigator." + action });
          });
        </script>
      </body>
    </html>
  `;
}

function isSelectBeaconMessage(
  message: NavigatorMessage,
): message is Extract<NavigatorMessage, { type: "navigator.selectBeacon" }> {
  return (
    message.type === "navigator.selectBeacon" &&
    "pathId" in message &&
    typeof message.pathId === "string" &&
    "beaconId" in message &&
    typeof message.beaconId === "string"
  );
}

function renderBeaconList(viewModel: Extract<NavigatorViewModel, { state: "ready" }>): string {
  const items = viewModel.beacons
    .map(
      (beacon) => `
        <li data-current="${beacon.isCurrent ? "true" : "false"}">
          <button
            data-action="select-beacon"
            data-path-id="${escapeHtml(viewModel.pathId)}"
            data-beacon-id="${escapeHtml(beacon.id)}"
            style="
              display: block;
              width: 100%;
              padding: 0.4rem 0.5rem;
              border: 0;
              border-radius: 4px;
              background: ${
                beacon.isCurrent
                  ? ACTIVE_BEACON_BUTTON_BACKGROUND
                  : INACTIVE_BEACON_BUTTON_BACKGROUND
              };
              color: ${BEACON_BUTTON_TEXT_COLOR};
              font-weight: ${beacon.isCurrent ? "600" : "400"};
              text-align: left;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            "
          >
            ${escapeHtml(beacon.title)}
          </button>
        </li>
      `,
    )
    .join("");

  return `
    <section
      aria-label="Beacon list"
      data-layout="fill"
      style="margin-top: 1rem; display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0;"
    >
      <h2 style="font-size: 0.9rem; margin: 0 0 0.5rem 0;">Beacon list</h2>
      <ol
        data-role="beacon-list"
        data-scrollable="true"
        style="
          margin: 0;
          padding: 0;
          list-style: none;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          display: grid;
          gap: 0.3rem;
        "
      >
        ${items}
      </ol>
    </section>
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
