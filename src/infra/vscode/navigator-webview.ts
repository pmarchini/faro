import type { NavigatorViewModel } from "../../app/views/navigator-view-model.ts";

type NavigatorMessage =
  | { type: "navigator.primaryAction" }
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
  onPrimaryAction(): Promise<void>;
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
  onPrimaryAction,
  onPrevious,
  onNext,
  onReveal,
  onSelectBeacon,
}: NavigatorWebviewDependencies): NavigatorWebviewAdapter {
  const subscription = webview.onDidReceiveMessage(async (message) => {
    if (message.type === "navigator.primaryAction") {
      await onPrimaryAction();
      render();
      return;
    }

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

    if (isSelectBeaconMessage(message)) {
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
  if (viewModel.state === "welcome") {
    return renderLayout({
      content: renderWelcomeState(viewModel),
    });
  }

  if (viewModel.state === "empty") {
    return renderLayout({
      content: `
        <header data-role="navigator-header" class="navigator-header">
          <span class="eyebrow">Faro</span>
          <h1 class="page-title">${escapeHtml(viewModel.title)}</h1>
        </header>
        <section data-section="empty-state" class="panel">
          <p class="body-copy">${escapeHtml(viewModel.message)}</p>
        </section>
        ${renderActions({ canGoPrevious: false, canGoNext: false })}
      `,
    });
  }

  return renderLayout({
    content: renderReadyState(viewModel),
  });
}

function renderLayout({
  content,
}: {
  content: string;
}): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <style>
          :root {
            color-scheme: light dark;
            --surface: var(--vscode-sideBar-background);
            --surface-muted: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.12));
            --surface-raised: var(--vscode-editorWidget-background, rgba(128, 128, 128, 0.08));
            --border: var(--vscode-sideBar-border, rgba(128, 128, 128, 0.28));
            --foreground: var(--vscode-foreground);
            --foreground-muted: var(--vscode-descriptionForeground);
            --button: var(--vscode-button-background);
            --button-foreground: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground, var(--vscode-button-background));
            --button-disabled: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.28));
            --list-active: var(--vscode-list-activeSelectionBackground, var(--vscode-button-background));
            --list-active-foreground: var(--vscode-list-activeSelectionForeground, #ffffff);
            --list-inactive: var(--vscode-list-inactiveSelectionBackground, rgba(128, 128, 128, 0.12));
            --list-inactive-foreground: var(--vscode-list-inactiveSelectionForeground, var(--vscode-foreground));
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            min-height: 100%;
            background: var(--surface);
            color: var(--foreground);
            font-family: var(--vscode-font-family, sans-serif);
            font-size: 13px;
          }

          body {
            height: 100vh;
          }

          main {
            height: 100vh;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.75rem;
            min-height: 0;
          }

          .navigator-header {
            display: grid;
            gap: 0.2rem;
          }

          .eyebrow,
          .section-label {
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--foreground-muted);
          }

          .page-title,
          .section-title {
            margin: 0;
            font-size: 1rem;
            line-height: 1.2;
          }

          .panel {
            display: grid;
            gap: 0.45rem;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-raised);
          }

          .welcome-shell {
            flex: 1 1 auto;
            display: grid;
            place-items: center;
            min-height: 0;
          }

          .welcome-card {
            width: 100%;
            display: grid;
            justify-items: center;
            gap: 1rem;
            padding: 1.4rem 1rem;
            border: 1px solid var(--border);
            border-radius: 18px;
            background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
            text-align: center;
          }

          .welcome-mark {
            width: 7rem;
            height: 7rem;
          }

          .welcome-copy {
            display: grid;
            gap: 0.55rem;
            justify-items: center;
          }

          .welcome-copy .page-title {
            font-size: 1.6rem;
          }

          .welcome-action {
            width: 100%;
            min-height: 2.75rem;
            border-radius: 12px;
            font-weight: 700;
          }

          .path-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .position-pill {
            padding: 0.18rem 0.45rem;
            border-radius: 999px;
            background: var(--surface-muted);
            color: var(--foreground);
            white-space: nowrap;
          }

          .body-copy {
            margin: 0;
            color: var(--foreground-muted);
            line-height: 1.45;
          }

          .tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
            margin: 0;
            padding: 0;
            list-style: none;
          }

          .tag {
            padding: 0.12rem 0.4rem;
            border-radius: 999px;
            background: var(--surface-muted);
            color: var(--foreground-muted);
            font-size: 0.82rem;
          }

          .actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.45rem;
          }

          .action-button {
            min-height: 2rem;
            border: 0;
            border-radius: 6px;
            background: var(--button);
            color: var(--button-foreground);
            font: inherit;
            cursor: pointer;
          }

          .action-button:hover:enabled {
            background: var(--button-hover);
          }

          .action-button:disabled {
            background: var(--button-disabled);
            cursor: default;
            opacity: 0.72;
          }

          .sequence-section {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            min-height: 0;
            gap: 0.5rem;
          }

          .sequence-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 0.5rem;
          }

          .beacon-list {
            margin: 0;
            padding: 0;
            list-style: none;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            display: grid;
            gap: 0.5rem;
          }

          .beacon-button {
            display: grid;
            gap: 0.45rem;
            width: 100%;
            padding: 0.7rem 0.75rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--list-inactive);
            color: var(--list-inactive-foreground);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          .beacon-button[data-current="true"] {
            background: var(--list-active);
            color: var(--list-active-foreground);
            border-color: transparent;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
          }

          .beacon-row-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
          }

          .step-chip,
          .current-chip {
            display: inline-flex;
            align-items: center;
            min-height: 1.3rem;
            padding: 0 0.45rem;
            border-radius: 999px;
            font-size: 0.74rem;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .step-chip {
            background: var(--surface-muted);
            color: var(--foreground-muted);
          }

          .beacon-button[data-current="true"] .step-chip {
            background: rgba(255, 255, 255, 0.18);
            color: inherit;
          }

          .current-chip {
            background: rgba(255, 255, 255, 0.18);
            color: inherit;
          }

          .beacon-button[data-current="false"] .current-chip {
            display: none;
          }

          .beacon-row-title {
            margin: 0;
            font-size: 0.94rem;
            line-height: 1.25;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .beacon-row-caption {
            color: var(--foreground-muted);
            font-size: 0.82rem;
            line-height: 1.35;
          }

          .beacon-button[data-current="true"] .beacon-row-caption {
            color: inherit;
            opacity: 0.88;
          }
        </style>
      </head>
      <body>
        <main>${content}</main>
        <script>
          const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
          const currentBeacon = document.querySelector('.beacon-button[data-current="true"]');
          if (currentBeacon instanceof HTMLElement) {
            currentBeacon.scrollIntoView({ block: "center", inline: "nearest" });
          }

          document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
              return;
            }

            const actionTarget = target.closest("[data-action]");
            if (!(actionTarget instanceof HTMLElement) || !vscode) {
              return;
            }

            const action = actionTarget.dataset.action;
            if (!action) {
              return;
            }

            if (action === "select-beacon") {
              const pathId = actionTarget.dataset.pathId;
              const beaconId = actionTarget.dataset.beaconId;

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
        <li data-role="beacon-row">
          <button
            class="beacon-button"
            data-action="select-beacon"
            data-path-id="${escapeHtml(viewModel.pathId)}"
            data-beacon-id="${escapeHtml(beacon.id)}"
            data-current="${beacon.isCurrent ? "true" : "false"}"
          >
            <span class="beacon-row-header">
              <span class="step-chip">Step ${String(beacon.stepNumber)}</span>
              <span class="current-chip">Current step</span>
            </span>
            <span class="beacon-row-title">${escapeHtml(beacon.title)}</span>
            <span class="beacon-row-caption">${escapeHtml(beacon.summary ?? "")}</span>
          </button>
        </li>
      `,
    )
    .join("");

  return `
    <section aria-label="Beacon sequence" data-section="beacon-sequence" class="sequence-section">
      <div class="sequence-header">
        <span class="section-label">Reading Spine</span>
        <h2 class="section-title">Beacon Sequence</h2>
      </div>
      <ol
        class="beacon-list"
        data-role="beacon-list"
        data-scrollable="true"
      >
        ${items}
      </ol>
    </section>
  `;
}

function renderReadyState(viewModel: Extract<NavigatorViewModel, { state: "ready" }>): string {
  return `
    <header data-role="navigator-header" class="navigator-header">
      <span class="eyebrow">Faro</span>
      <h1 class="page-title">${escapeHtml(viewModel.pathTitle)}</h1>
    </header>
    <section data-section="active-path-summary" class="panel">
      <div class="path-meta">
        <span class="section-label">Active Path</span>
        <span class="position-pill">${escapeHtml(viewModel.positionLabel)}</span>
      </div>
      <p class="body-copy">${escapeHtml(viewModel.goal)}</p>
    </section>
    <section data-section="current-beacon" class="panel">
      <span class="section-label">Current Beacon</span>
      <h2 class="section-title">${escapeHtml(viewModel.beaconTitle)}</h2>
      <p class="body-copy">${escapeHtml(viewModel.summary)}</p>
      <p class="body-copy">${escapeHtml(viewModel.explanation)}</p>
      ${renderTags(viewModel.tags)}
    </section>
    ${renderActions({
      canGoPrevious: viewModel.canGoPrevious,
      canGoNext: viewModel.canGoNext,
    })}
    ${renderBeaconList(viewModel)}
  `;
}

function renderWelcomeState(
  viewModel: Extract<NavigatorViewModel, { state: "welcome" }>,
): string {
  return `
    <section class="welcome-shell" aria-label="Faro welcome view">
      <div class="welcome-card" data-section="welcome">
        <svg class="welcome-mark" viewBox="0 0 256 256" aria-hidden="true">
          <rect x="10" y="10" width="236" height="236" rx="58" stroke="#3C5A74" stroke-width="6" fill="none" />
          <g transform="translate(128 128) scale(1.3) translate(-128 -128)">
            <path d="M86 92L128 70L170 92L170 140L128 162L86 140Z" stroke="#67D2FF" stroke-width="7" stroke-linejoin="round" fill="none" />
            <path d="M86 140L128 118L170 140" stroke="#67D2FF" stroke-width="7" fill="none" />
            <circle cx="86" cy="92" r="7" fill="#67D2FF" />
            <circle cx="128" cy="70" r="7" fill="#67D2FF" />
            <circle cx="170" cy="92" r="7" fill="#67D2FF" />
            <circle cx="86" cy="140" r="7" fill="#67D2FF" />
            <circle cx="128" cy="118" r="7" fill="#67D2FF" />
            <circle cx="170" cy="140" r="7" fill="#67D2FF" />
            <path d="M128 82L140 102H116Z" fill="#F4F7FB" />
            <rect x="117" y="102" width="22" height="16" rx="6" fill="#F4F7FB" />
            <path d="M113 118H143L151 184H105Z" fill="#F4F7FB" />
            <path d="M102 186H154" stroke="#F4F7FB" stroke-width="9" stroke-linecap="round" />
          </g>
        </svg>
        <div class="welcome-copy">
          <span class="eyebrow">Welcome to Faro</span>
          <h1 class="page-title">${escapeHtml(viewModel.title)}</h1>
          <p class="body-copy">${escapeHtml(viewModel.message)}</p>
        </div>
        <button class="action-button welcome-action" data-action="primaryAction">${escapeHtml(viewModel.primaryActionLabel)}</button>
      </div>
    </section>
  `;
}

function renderActions({
  canGoPrevious,
  canGoNext,
}: {
  canGoPrevious: boolean;
  canGoNext: boolean;
}): string {
  return `
    <section class="actions" aria-label="Navigator actions">
      <button class="action-button" ${canGoPrevious ? "" : "disabled"} data-action="previous">Prev</button>
      <button class="action-button" data-action="reveal">Reveal</button>
      <button class="action-button" ${canGoNext ? "" : "disabled"} data-action="next">Next</button>
    </section>
  `;
}

function renderTags(tags: string[]): string {
  if (tags.length === 0) {
    return "";
  }

  return `
    <ul class="tag-list">
      ${tags.map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`).join("")}
    </ul>
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
