import type {
  SetupViewModel,
} from "../../../../../app/views/setup-view-model.ts";
import type { SetupScope, SetupTargetId } from "../../../../../setup/setup-contract.ts";

type SetupMessage =
  | { type: "setup.setScope"; scope: SetupScope }
  | { type: "setup.installTarget"; targetId: SetupTargetId }
  | { type: string };

type Disposable = {
  dispose(): void;
};

type WebviewLike = {
  html: string;
  onDidReceiveMessage(
    listener: (message: SetupMessage) => void | Promise<void>,
  ): Disposable;
};

type SetupWebviewDependencies = {
  webview: WebviewLike;
  getViewModel(): SetupViewModel;
  onSelectScope(scope: SetupScope): Promise<void>;
  onInstallTarget(targetId: SetupTargetId): Promise<void>;
};

type SetupWebviewAdapter = Disposable & {
  render(): void;
};

export function createSetupWebviewAdapter({
  webview,
  getViewModel,
  onSelectScope,
  onInstallTarget,
}: SetupWebviewDependencies): SetupWebviewAdapter {
  const subscription = webview.onDidReceiveMessage(async (message) => {
    if (isSetScopeMessage(message)) {
      await onSelectScope(message.scope);
      render();
      return;
    }

    if (isInstallTargetMessage(message)) {
      await onInstallTarget(message.targetId);
      render();
    }
  });

  function render(): void {
    webview.html = renderSetupHtml(getViewModel());
  }

  return {
    render,
    dispose() {
      subscription.dispose();
    },
  };
}

export function renderSetupHtml(viewModel: SetupViewModel): string {
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
            --button-secondary: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.16));
            --badge-installed-bg: rgba(113, 214, 162, 0.16);
            --badge-installed-text: #9ef0c1;
            --badge-missing-bg: rgba(255, 255, 255, 0.08);
            --badge-missing-text: var(--foreground);
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

          body {
            height: 100vh;
          }

          main {
            min-height: 100vh;
            display: grid;
            gap: 0.9rem;
            padding: 0.75rem;
            align-content: start;
          }

          .header,
          .scope,
          .row {
            display: grid;
            gap: 0.55rem;
            padding: 0.85rem;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface-raised);
          }

          .eyebrow {
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--foreground-muted);
          }

          .title {
            margin: 0;
            font-size: 1.2rem;
            line-height: 1.1;
          }

          .copy,
          .scope-hint,
          .feedback,
          .loading {
            margin: 0;
            color: var(--foreground-muted);
            line-height: 1.5;
          }

          .scope-switch {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.45rem;
          }

          .scope-button,
          .action-button {
            min-height: 2rem;
            border: 0;
            border-radius: 10px;
            font: inherit;
            cursor: pointer;
          }

          .scope-button {
            background: var(--button-secondary);
            color: var(--foreground);
            font-weight: 700;
          }

          .scope-button[data-selected="true"] {
            background: var(--button);
            color: var(--button-foreground);
          }

          .list {
            display: grid;
            gap: 0.75rem;
          }

          .row-top,
          .row-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .row-title {
            margin: 0;
            font-size: 0.98rem;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 1.5rem;
            padding: 0 0.6rem;
            border-radius: 999px;
            font-size: 0.72rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            font-weight: 700;
          }

          .badge[data-status="Installed"] {
            background: var(--badge-installed-bg);
            color: var(--badge-installed-text);
          }

          .badge[data-status="Missing"] {
            background: var(--badge-missing-bg);
            color: var(--badge-missing-text);
          }

          .action-button {
            background: var(--button);
            color: var(--button-foreground);
            padding: 0 0.85rem;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="header">
            <span class="eyebrow">Setup</span>
            <h1 class="title">${escapeHtml(viewModel.title)}</h1>
            <p class="copy">${escapeHtml(viewModel.description)}</p>
          </section>

          <section class="scope">
            <span class="eyebrow">Install Scope</span>
            <div class="scope-switch">
              ${viewModel.scopeOptions
                .map(
                  (option) => `
                    <button
                      class="scope-button"
                      data-action="set-scope"
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

          ${viewModel.isLoading
            ? `<p class="loading">${escapeHtml(viewModel.loadingLabel)}</p>`
            : `
              <section class="list" aria-label="Integration targets">
                ${viewModel.items
                  .map(
                    (item) => `
                      <article class="row">
                        <div class="row-top">
                          <h2 class="row-title">${escapeHtml(item.title)}</h2>
                          <span class="badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
                        </div>
                        <p class="copy">${escapeHtml(item.description)}</p>
                        <div class="row-footer">
                          <span class="eyebrow">${escapeHtml(viewModel.selectedScope)}</span>
                          <button
                            class="action-button"
                            data-action="install-target"
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
            `}

          ${viewModel.feedback
            ? `<p class="feedback">${escapeHtml(viewModel.feedback.message)}</p>`
            : ""}
        </main>
        <script>
          const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

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
            if (action === "set-scope") {
              const scope = actionTarget.dataset.scope;
              if (scope === "local" || scope === "global") {
                vscode.postMessage({ type: "setup.setScope", scope });
              }
              return;
            }

            if (action === "install-target") {
              const targetId = actionTarget.dataset.targetId;
              if (targetId) {
                vscode.postMessage({ type: "setup.installTarget", targetId });
              }
            }
          });
        </script>
      </body>
    </html>
  `;
}

function isSetScopeMessage(
  message: SetupMessage,
): message is Extract<SetupMessage, { type: "setup.setScope" }> {
  return (
    message.type === "setup.setScope" &&
    "scope" in message &&
    (message.scope === "local" || message.scope === "global")
  );
}

function isInstallTargetMessage(
  message: SetupMessage,
): message is Extract<SetupMessage, { type: "setup.installTarget" }> {
  return (
    message.type === "setup.installTarget" &&
    "targetId" in message &&
    typeof message.targetId === "string"
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
