import type { HomeViewModel } from "../../app/views/home-view-model.ts";
import type { NavigatorViewModel } from "../../app/views/navigator-view-model.ts";
import type { SetupViewModel } from "../../app/views/setup-view-model.ts";
import type { SetupScope, SetupTargetId } from "../../setup/setup-contract.ts";
import type { MainRoute } from "../../ui/main-route.ts";

type MainMessage =
  | { type: "main.openHome" }
  | { type: "main.openPath" }
  | { type: "main.openSetup" }
  | { type: "main.previous" }
  | { type: "main.next" }
  | { type: "main.reveal" }
  | { type: "main.selectBeacon"; pathId: string; beaconId: string }
  | { type: "main.setupSetScope"; scope: SetupScope }
  | { type: "main.setupInstallTarget"; targetId: SetupTargetId }
  | { type: string };

type Disposable = {
  dispose(): void;
};

type WebviewLike = {
  html: string;
  onDidReceiveMessage(
    listener: (message: MainMessage) => void | Promise<void>,
  ): Disposable;
};

export type MainWebviewViewModel = {
  selectedRoute: MainRoute;
  routes: Array<{
    id: MainRoute;
    label: string;
    isSelected: boolean;
  }>;
  home: HomeViewModel;
  path: NavigatorViewModel;
  setup: SetupViewModel;
};

type Dependencies = {
  webview: WebviewLike;
  getViewModel(): MainWebviewViewModel;
  onOpenHome(): Promise<void>;
  onOpenPath(): Promise<void>;
  onOpenSetup(): Promise<void>;
  onPrevious(): Promise<void>;
  onNext(): Promise<void>;
  onReveal(): Promise<void>;
  onSelectBeacon(pathId: string, beaconId: string): Promise<void>;
  onSetupSelectScope(scope: SetupScope): Promise<void>;
  onSetupInstallTarget(targetId: SetupTargetId): Promise<void>;
};

export function createMainWebviewAdapter({
  webview,
  getViewModel,
  onOpenHome,
  onOpenPath,
  onOpenSetup,
  onPrevious,
  onNext,
  onReveal,
  onSelectBeacon,
  onSetupSelectScope,
  onSetupInstallTarget,
}: Dependencies): Disposable & { render(): void } {
  const subscription = webview.onDidReceiveMessage(async (message) => {
    if (message.type === "main.openHome") {
      await onOpenHome();
      render();
      return;
    }

    if (message.type === "main.openPath") {
      await onOpenPath();
      render();
      return;
    }

    if (message.type === "main.openSetup") {
      await onOpenSetup();
      render();
      return;
    }

    if (message.type === "main.previous") {
      await onPrevious();
      render();
      return;
    }

    if (message.type === "main.next") {
      await onNext();
      render();
      return;
    }

    if (message.type === "main.reveal") {
      await onReveal();
      render();
      return;
    }

    if (isSelectBeaconMessage(message)) {
      await onSelectBeacon(message.pathId, message.beaconId);
      render();
      return;
    }

    if (isSetupSetScopeMessage(message)) {
      await onSetupSelectScope(message.scope);
      render();
      return;
    }

    if (isSetupInstallTargetMessage(message)) {
      await onSetupInstallTarget(message.targetId);
      render();
    }
  });

  function render(): void {
    webview.html = renderMainHtml(getViewModel());
  }

  return {
    render,
    dispose() {
      subscription.dispose();
    },
  };
}

export function renderMainHtml(viewModel: MainWebviewViewModel): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <style>
          :root {
            color-scheme: light dark;
            --surface: var(--vscode-sideBar-background);
            --surface-raised: var(--vscode-editorWidget-background, rgba(128, 128, 128, 0.08));
            --surface-muted: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.12));
            --border: var(--vscode-sideBar-border, rgba(128, 128, 128, 0.28));
            --foreground: var(--vscode-foreground);
            --foreground-muted: var(--vscode-descriptionForeground);
            --button: var(--vscode-button-background);
            --button-foreground: var(--vscode-button-foreground);
            --button-secondary: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.16));
            --list-active: var(--vscode-list-activeSelectionBackground, var(--vscode-button-background));
            --list-active-foreground: var(--vscode-list-activeSelectionForeground, #ffffff);
          }

          * { box-sizing: border-box; }

          html, body {
            margin: 0;
            min-height: 100%;
            background: var(--surface);
            color: var(--foreground);
            font-family: var(--vscode-font-family, sans-serif);
            font-size: 13px;
          }

          body { height: 100vh; }

          main {
            min-height: 100vh;
            display: grid;
            align-content: start;
            gap: 0.85rem;
            padding: 0.75rem;
          }

          .shell,
          .panel,
          .entry,
          .beacon,
          .row {
            display: grid;
            gap: 0.55rem;
            padding: 0.85rem;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface-raised);
          }

          .nav {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.45rem;
          }

          .home-hero {
            gap: 0.8rem;
            justify-items: start;
          }

          .home-logo {
            width: 4.4rem;
            height: 4.4rem;
            display: block;
          }

          .home-actions {
            display: grid;
            gap: 0.75rem;
          }

          .home-card {
            width: 100%;
            display: grid;
            gap: 0.7rem;
            padding: 0.95rem;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface-raised);
            color: var(--foreground);
            text-align: left;
            cursor: pointer;
            font: inherit;
          }

          .home-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .home-card-title {
            margin: 0;
            font-size: 0.98rem;
            line-height: 1.25;
          }

          .home-card-action {
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--foreground-muted);
          }

          .nav-button,
          .action-button,
          .entry-button,
          .scope-button {
            min-height: 2.1rem;
            border: 0;
            border-radius: 10px;
            font: inherit;
            cursor: pointer;
          }

          .nav-button,
          .scope-button {
            background: var(--button-secondary);
            color: var(--foreground);
            font-weight: 700;
          }

          .nav-button[data-selected="true"],
          .scope-button[data-selected="true"] {
            background: var(--button);
            color: var(--button-foreground);
          }

          .eyebrow {
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--foreground-muted);
          }

          .title,
          .section-title,
          .row-title {
            margin: 0;
            font-size: 1rem;
            line-height: 1.2;
          }

          .body-copy,
          .muted,
          .scope-hint,
          .feedback {
            margin: 0;
            color: var(--foreground-muted);
            line-height: 1.5;
          }

          .entry-button,
          .action-button {
            background: var(--button);
            color: var(--button-foreground);
            font-weight: 700;
            padding: 0 0.9rem;
          }

          .entry-top,
          .path-meta,
          .row-top,
          .row-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .pill,
          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 1.5rem;
            padding: 0 0.55rem;
            border-radius: 999px;
            background: var(--surface-muted);
            color: var(--foreground);
            font-size: 0.72rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            font-weight: 700;
            border: 0;
          }

          .beacon-list,
          .list {
            display: grid;
            gap: 0.7rem;
          }

          .beacon-button {
            display: grid;
            gap: 0.45rem;
            width: 100%;
            padding: 0.7rem 0.75rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--surface-muted);
            color: var(--foreground);
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

          .scope-switch {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.45rem;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="shell">
            <span class="eyebrow">Faro</span>
            <h1 class="title">One sidebar, three focused destinations.</h1>
            <p class="body-copy">Move between home, path reading, and setup without adding more views to the VS Code activity bar.</p>
            <div class="nav">
              ${viewModel.routes
                .map(
                  (route) => `
                    <button class="nav-button" data-action="open-${escapeHtml(route.id)}" data-selected="${route.isSelected ? "true" : "false"}">
                      ${escapeHtml(route.label)}
                    </button>
                  `,
                )
                .join("")}
            </div>
          </section>

          ${renderSelectedRoute(viewModel)}
        </main>
        <script>
          const vscode = acquireVsCodeApi();
          document.addEventListener("click", (event) => {
            const actionTarget = event.target instanceof HTMLElement
              ? event.target.closest("[data-action]")
              : null;

            if (!actionTarget) {
              return;
            }

            const action = actionTarget.dataset.action;

            if (action === "open-home") {
              vscode.postMessage({ type: "main.openHome" });
              return;
            }

            if (action === "open-path") {
              vscode.postMessage({ type: "main.openPath" });
              return;
            }

            if (action === "open-setup") {
              vscode.postMessage({ type: "main.openSetup" });
              return;
            }

            if (action === "previous") {
              vscode.postMessage({ type: "main.previous" });
              return;
            }

            if (action === "next") {
              vscode.postMessage({ type: "main.next" });
              return;
            }

            if (action === "reveal") {
              vscode.postMessage({ type: "main.reveal" });
              return;
            }

            if (action === "select-beacon") {
              vscode.postMessage({
                type: "main.selectBeacon",
                pathId: actionTarget.dataset.pathId,
                beaconId: actionTarget.dataset.beaconId,
              });
              return;
            }

            if (action === "setup-set-scope") {
              vscode.postMessage({
                type: "main.setupSetScope",
                scope: actionTarget.dataset.scope,
              });
              return;
            }

            if (action === "setup-install-target") {
              vscode.postMessage({
                type: "main.setupInstallTarget",
                targetId: actionTarget.dataset.targetId,
              });
            }
          });
        </script>
      </body>
    </html>
  `;
}

function renderSelectedRoute(viewModel: MainWebviewViewModel): string {
  if (viewModel.selectedRoute === "home") {
    return `
      <section class="panel home-hero">
        <span class="eyebrow">Faro Home</span>
        ${renderFaroLogo()}
        <h2 class="section-title">${escapeHtml(viewModel.home.title)}</h2>
        <p class="body-copy">${escapeHtml(viewModel.home.message)}</p>
      </section>

      <section class="panel">
        <span class="eyebrow">Start Here</span>
        <div class="home-actions">
          <button class="home-card" data-action="open-path">
            <div class="home-card-top">
              <h3 class="home-card-title">${escapeHtml(viewModel.home.resumeLabel)}</h3>
              <span class="badge">1</span>
            </div>
            <p class="body-copy">${escapeHtml(viewModel.home.currentPathSummary)}</p>
          </button>

          <button class="home-card" data-action="open-setup">
            <div class="home-card-top">
              <h3 class="home-card-title">${escapeHtml(viewModel.home.setupLabel)}</h3>
              <span class="badge">S</span>
            </div>
            <p class="body-copy">${escapeHtml(viewModel.home.setupSummary)}</p>
            <div class="home-card-action">Inspect local and global integrations</div>
          </button>
        </div>
      </section>
    `;
  }

  if (viewModel.selectedRoute === "setup") {
    return renderSetupRoute(viewModel.setup);
  }

  return renderPathRoute(viewModel.path);
}

function renderPathRoute(viewModel: NavigatorViewModel): string {
  if (viewModel.state === "empty") {
    return `
      <section class="panel">
        <span class="eyebrow">Path</span>
        <h2 class="section-title">${escapeHtml(viewModel.title)}</h2>
        <p class="body-copy">${escapeHtml(viewModel.message)}</p>
      </section>
    `;
  }

  if (viewModel.state === "welcome") {
    return `
      <section class="panel">
        <span class="eyebrow">Path</span>
        <h2 class="section-title">${escapeHtml(viewModel.title)}</h2>
        <p class="body-copy">${escapeHtml(viewModel.message)}</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="path-meta">
        <div>
          <span class="eyebrow">Current Path</span>
          <h2 class="section-title">${escapeHtml(viewModel.pathTitle)}</h2>
        </div>
        <span class="pill">${escapeHtml(viewModel.positionLabel)}</span>
      </div>
      <p class="body-copy">${escapeHtml(viewModel.goal)}</p>
    </section>

    <section class="panel">
      <span class="eyebrow">Current Beacon</span>
      <h2 class="section-title">${escapeHtml(viewModel.beaconTitle)}</h2>
      <p class="body-copy">${escapeHtml(viewModel.summary)}</p>
      <p class="body-copy">${escapeHtml(viewModel.explanation)}</p>
      <div class="row-footer">
        <button class="action-button" data-action="previous">Prev</button>
        <button class="action-button" data-action="reveal">Reveal</button>
        <button class="action-button" data-action="next">Next</button>
      </div>
    </section>

    <section class="panel">
      <span class="eyebrow">Beacon Sequence</span>
      <div class="beacon-list">
        ${viewModel.beacons
          .map(
            (beacon) => `
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
                <span class="beacon-row-caption">${escapeHtml(beacon.summary)}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSetupRoute(viewModel: SetupViewModel): string {
  return `
    <section class="panel">
      <span class="eyebrow">Setup</span>
      <h2 class="section-title">${escapeHtml(viewModel.title)}</h2>
      <p class="body-copy">${escapeHtml(viewModel.description)}</p>
      <div class="scope-switch">
        ${viewModel.scopeOptions
          .map(
            (option) => `
              <button
                class="scope-button"
                data-action="setup-set-scope"
                data-scope="${escapeHtml(option.value)}"
                data-selected="${option.isSelected ? "true" : "false"}"
              >
                ${escapeHtml(option.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <p class="scope-hint">${escapeHtml(viewModel.scopeHint)}</p>
    </section>

    ${
      viewModel.isLoading
        ? `<section class="panel"><p class="body-copy">${escapeHtml(viewModel.loadingLabel)}</p></section>`
        : `
          <section class="list">
            ${viewModel.items
              .map(
                (item) => `
                  <article class="row">
                    <div class="row-top">
                      <h3 class="row-title">${escapeHtml(item.title)}</h3>
                      <span class="badge">${escapeHtml(item.status)}</span>
                    </div>
                    <p class="body-copy">${escapeHtml(item.description)}</p>
                    <div class="row-footer">
                      <span class="muted">${escapeHtml(item.status)}</span>
                      <button
                        class="action-button"
                        data-action="setup-install-target"
                        data-target-id="${escapeHtml(item.id)}"
                      >
                        ${escapeHtml(item.actionLabel)}
                      </button>
                    </div>
                  </article>
                `,
              )
              .join("")}
          </section>
        `
    }

    ${
      viewModel.feedback
        ? `<section class="panel"><p class="feedback">${escapeHtml(viewModel.feedback.message)}</p></section>`
        : ""
    }
  `;
}

function isSelectBeaconMessage(
  message: MainMessage,
): message is { type: "main.selectBeacon"; pathId: string; beaconId: string } {
  const candidate = message as Partial<{ pathId: unknown; beaconId: unknown }>;
  return (
    message.type === "main.selectBeacon" &&
    typeof candidate.pathId === "string" &&
    typeof candidate.beaconId === "string"
  );
}

function isSetupSetScopeMessage(
  message: MainMessage,
): message is { type: "main.setupSetScope"; scope: SetupScope } {
  const candidate = message as Partial<{ scope: unknown }>;
  return (
    message.type === "main.setupSetScope" &&
    (candidate.scope === "local" || candidate.scope === "global")
  );
}

function isSetupInstallTargetMessage(
  message: MainMessage,
): message is { type: "main.setupInstallTarget"; targetId: SetupTargetId } {
  const candidate = message as Partial<{ targetId: unknown }>;
  return (
    message.type === "main.setupInstallTarget" &&
    typeof candidate.targetId === "string"
  );
}

function renderFaroLogo(): string {
  return `
    <svg
      class="home-logo"
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Faro logo"
      role="img"
    >
      <rect
        x="10"
        y="10"
        width="236"
        height="236"
        rx="58"
        stroke="#3C5A74"
        stroke-width="6"
      />
      <g transform="translate(128 128) scale(1.3) translate(-128 -128)">
        <path
          d="M86 92L128 70L170 92L170 140L128 162L86 140Z"
          stroke="#67D2FF"
          stroke-width="7"
          stroke-linejoin="round"
        />
        <path d="M86 140L128 118L170 140" stroke="#67D2FF" stroke-width="7" />
        <circle cx="86" cy="92" r="7" fill="#67D2FF" />
        <circle cx="128" cy="70" r="7" fill="#67D2FF" />
        <circle cx="170" cy="92" r="7" fill="#67D2FF" />
        <circle cx="86" cy="140" r="7" fill="#67D2FF" />
        <circle cx="128" cy="118" r="7" fill="#67D2FF" />
        <circle cx="170" cy="140" r="7" fill="#67D2FF" />
        <path d="M128 82L140 102H116Z" fill="#F4F7FB" />
        <rect x="117" y="102" width="22" height="16" rx="6" fill="#F4F7FB" />
        <path d="M113 118H143L151 184H105Z" fill="#F4F7FB" />
        <path
          d="M102 186H154"
          stroke="#F4F7FB"
          stroke-width="9"
          stroke-linecap="round"
        />
      </g>
    </svg>
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
