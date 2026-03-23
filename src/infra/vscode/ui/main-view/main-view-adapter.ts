import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  NavigatorBeaconListItem,
  NavigatorViewModel,
} from "../../../../app/views/navigator-view-model.ts";
import type { SetupViewModel } from "../../../../app/views/setup-view-model.ts";
import type { SetupScope, SetupTargetId } from "../../../../setup/setup-contract.ts";
import { MainViewApp } from "./main-view-app.ts";
import {
  isMainMessage,
  mainMessageType,
  type MainMessage,
  type MainWebviewViewModel,
} from "./main-view-contract.ts";

type Disposable = {
  dispose(): void;
};

type WebviewLike = {
  html: string;
  options?: Record<string, unknown>;
  resolveWebviewUri?(path: string): string;
  setLocalResourceRoots?(paths: string[]): void;
  onDidReceiveMessage(
    listener: (message: unknown) => void | Promise<void>,
  ): Disposable;
};

type MainWebviewAssets = {
  cssUri?: string;
  jsUri?: string;
};

type MainWebviewAdapterError =
  | { kind: "render"; cause: unknown }
  | { kind: "message"; message: unknown; cause: unknown };

type Dependencies = {
  webview: WebviewLike;
  getViewModel(): MainWebviewViewModel;
  getAssets?(): MainWebviewAssets;
  onOpenHome(): Promise<void>;
  onOpenPath(): Promise<void>;
  onOpenSetup(): Promise<void>;
  onPrevious(): Promise<void>;
  onNext(): Promise<void>;
  onReveal(): Promise<void>;
  onRequestDeletePath(pathId: string, pathTitle: string): Promise<void>;
  onCancelDeletePath(): Promise<void>;
  onConfirmDeletePath(pathId: string): Promise<void>;
  onSelectBeacon(pathId: string, beaconId: string): Promise<void>;
  onSetupSelectScope(scope: SetupScope): Promise<void>;
  onSetupRequestInstallTarget(targetId: SetupTargetId): Promise<void>;
  onSetupCancelInstallTarget(): Promise<void>;
  onSetupConfirmInstallTarget(targetId: SetupTargetId): Promise<void>;
};

type MainWebviewAdapter = Disposable & {
  render(): boolean;
  clearError(): void;
  readonly lastError?: MainWebviewAdapterError;
};

export function createMainWebviewAdapter({
  webview,
  getViewModel,
  getAssets = () => ({}),
  onOpenHome,
  onOpenPath,
  onOpenSetup,
  onPrevious,
  onNext,
  onReveal,
  onRequestDeletePath,
  onCancelDeletePath,
  onConfirmDeletePath,
  onSelectBeacon,
  onSetupSelectScope,
  onSetupRequestInstallTarget,
  onSetupCancelInstallTarget,
  onSetupConfirmInstallTarget,
}: Dependencies): MainWebviewAdapter {
  let lastError: MainWebviewAdapterError | undefined;
  const handlers: MainMessageHandlerMap = {
    [mainMessageType.openHome]: async () => {
      await onOpenHome();
    },
    [mainMessageType.openPath]: async () => {
      await onOpenPath();
    },
    [mainMessageType.openSetup]: async () => {
      await onOpenSetup();
    },
    [mainMessageType.previous]: async () => {
      await onPrevious();
    },
    [mainMessageType.next]: async () => {
      await onNext();
    },
    [mainMessageType.reveal]: async () => {
      await onReveal();
    },
    [mainMessageType.requestDeletePath]: async (message) => {
      await onRequestDeletePath(message.pathId, message.pathTitle);
    },
    [mainMessageType.cancelDeletePath]: async () => {
      await onCancelDeletePath();
    },
    [mainMessageType.confirmDeletePath]: async (message) => {
      await onConfirmDeletePath(message.pathId);
    },
    [mainMessageType.selectBeacon]: async (message) => {
      await onSelectBeacon(message.pathId, message.beaconId);
    },
    [mainMessageType.setupSetScope]: async (message) => {
      await onSetupSelectScope(message.scope);
    },
    [mainMessageType.setupRequestInstallTarget]: async (message) => {
      await onSetupRequestInstallTarget(message.targetId);
    },
    [mainMessageType.setupCancelInstallTarget]: async () => {
      await onSetupCancelInstallTarget();
    },
    [mainMessageType.setupConfirmInstallTarget]: async (message) => {
      await onSetupConfirmInstallTarget(message.targetId);
    },
  };

  const subscription = webview.onDidReceiveMessage(async (message) => {
    if (!isMainMessage(message)) {
      return;
    }

    try {
      await dispatchMainMessage(handlers, message);
      lastError = undefined;
      render();
    } catch (cause) {
      lastError = {
        kind: "message",
        message,
        cause,
      };
    }
  });

  function render(): boolean {
    try {
      webview.html = renderMainHtml(getViewModel(), getAssets());
      lastError = undefined;
      return true;
    } catch (cause) {
      lastError = {
        kind: "render",
        cause,
      };
      return false;
    }
  }

  return {
    render,
    clearError() {
      lastError = undefined;
    },
    get lastError() {
      return lastError;
    },
    dispose() {
      subscription.dispose();
    },
  };
}

type MainMessageHandlerMap = {
  [Type in MainMessage["type"]]: (
    message: Extract<MainMessage, { type: Type }>,
  ) => Promise<void>;
};

function dispatchMainMessage(
  handlers: MainMessageHandlerMap,
  message: MainMessage,
): Promise<void> {
  return (handlers[message.type] as (message: MainMessage) => Promise<void>)(message);
}

export function renderMainHtml(
  viewModel: MainWebviewViewModel,
  assets: MainWebviewAssets = {},
): string {
  const hasPendingDeleteConfirmation = viewModel.selectedRoute === "path" &&
    Boolean(viewModel.pendingPathDeleteConfirmation);
  const hasPendingSetupConfirmation = viewModel.selectedRoute === "setup" &&
    Boolean(viewModel.setup.pendingInstallConfirmation);
  const hasPendingConfirmation = hasPendingDeleteConfirmation || hasPendingSetupConfirmation;
  const appHtml = renderToStaticMarkup(
    React.createElement(MainViewApp, {
      viewModel,
    }),
  );
  const bootstrapPayload = JSON.stringify({ viewModel }).replaceAll("<", "\\u003c");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        ${assets.cssUri ? `<link rel="stylesheet" href="${escapeHtml(assets.cssUri)}">` : ""}
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
            --button-danger: color-mix(
              in srgb,
              var(--vscode-errorForeground, #c74f5f) 22%,
              var(--surface-raised)
            );
            --button-danger-border: color-mix(
              in srgb,
              var(--vscode-errorForeground, #c74f5f) 52%,
              transparent
            );
            --button-danger-foreground: var(--vscode-errorForeground, #c74f5f);
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
            transition: filter 140ms ease, transform 140ms ease;
          }

          .shell,
          .panel,
          .confirmation,
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

          body[data-modal-open="true"] main {
            filter: blur(4px);
            transform: scale(0.985);
            pointer-events: none;
            user-select: none;
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

          .action-button[data-variant="secondary"] {
            background: var(--button-secondary);
            color: var(--foreground);
          }

          .action-button[data-variant="danger"] {
            background: var(--button-danger);
            color: var(--button-danger-foreground);
            border: 1px solid var(--button-danger-border);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
          }

          .confirmation {
            gap: 0.7rem;
            width: min(100%, 29rem);
            box-shadow: 0 22px 54px rgba(0, 0, 0, 0.34);
            background: color-mix(in srgb, var(--surface) 76%, var(--surface-raised));
          }

          .confirmation-header,
          .confirmation-meta,
          .confirmation-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .confirmation-meta {
            flex-wrap: wrap;
          }

          .confirmation-warning {
            display: grid;
            gap: 0.35rem;
            padding: 0.75rem;
            border-radius: 12px;
            border: 1px solid rgba(198, 145, 71, 0.35);
            background: rgba(198, 145, 71, 0.12);
          }

          .modal-layer {
            position: fixed;
            inset: 0;
            z-index: 10;
            display: grid;
            place-items: center;
            padding: 1rem;
            background: rgba(15, 18, 24, 0.22);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }
        </style>
      </head>
      <body data-modal-open="${hasPendingConfirmation ? "true" : "false"}">
        <div id="faro-main-root">${appHtml}</div>
        ${
          assets.jsUri
            ? `<script id="faro-main-bootstrap" type="application/json">${bootstrapPayload}</script>
               <script type="module" src="${escapeHtml(assets.jsUri)}"></script>`
            : ""
        }
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
