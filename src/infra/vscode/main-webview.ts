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
          }

          .beacon-list,
          .list {
            display: grid;
            gap: 0.7rem;
          }

          .beacon.current {
            background: var(--list-active);
            color: var(--list-active-foreground);
          }

          .beacon.current .muted {
            color: var(--list-active-foreground);
            opacity: 0.84;
          }

          .step {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 1.8rem;
            height: 1.8rem;
            border-radius: 10px;
            background: var(--surface-muted);
            font-size: 0.82rem;
            font-weight: 700;
          }

          .beacon-button {
            padding: 0;
            border: 0;
            background: transparent;
            color: inherit;
            text-align: left;
            cursor: pointer;
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
            <h1 class="title">One entry point for paths and setup.</h1>
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
      <section class="entry">
        <span class="eyebrow">Home</span>
        <div class="entry-top">
          <h2 class="section-title">${escapeHtml(viewModel.home.currentPathTitle)}</h2>
          <span class="pill">Current</span>
        </div>
        <p class="body-copy">${escapeHtml(viewModel.home.currentPathSummary)}</p>
        <button class="entry-button" data-action="open-path">${escapeHtml(viewModel.home.resumeLabel)}</button>
      </section>

      <section class="entry">
        <span class="eyebrow">Setup</span>
        <h2 class="section-title">${escapeHtml(viewModel.home.setupLabel)}</h2>
        <p class="body-copy">${escapeHtml(viewModel.home.setupSummary)}</p>
        <button class="entry-button" data-action="open-setup">${escapeHtml(viewModel.home.setupLabel)}</button>
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
              <article class="beacon ${beacon.isCurrent ? "current" : ""}">
                <div class="row-top">
                  <span class="step">${beacon.stepNumber}</span>
                  <button
                    class="beacon-button"
                    data-action="select-beacon"
                    data-path-id="${escapeHtml(viewModel.pathId)}"
                    data-beacon-id="${escapeHtml(beacon.id)}"
                  >
                    <strong>${escapeHtml(beacon.title)}</strong>
                  </button>
                </div>
                <p class="muted">${escapeHtml(beacon.summary)}</p>
              </article>
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
