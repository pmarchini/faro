import React from "react";
import { hydrateRoot, type Root } from "react-dom/client";

import { MainViewApp } from "./main-view-app.ts";
import type { MainMessage, MainViewBridge, MainWebviewViewModel } from "./main-view-contract.ts";

type VscodeApi = {
  postMessage(message: MainMessage): void;
};

type HydrateMainViewOptions = {
  acquireVsCodeApi?: () => VscodeApi;
  document?: Document;
};

type BootstrapPayload = {
  viewModel: MainWebviewViewModel;
};

export function hydrateMainView({
  acquireVsCodeApi = defaultAcquireVsCodeApi,
  document: nextDocument = globalThis.document,
}: HydrateMainViewOptions = {}): { dispose(): void } {
  if (!nextDocument) {
    return { dispose() {} };
  }

  const rootElement = nextDocument.getElementById("faro-main-root");
  if (!(rootElement instanceof HTMLElement)) {
    return { dispose() {} };
  }

  const bootstrapScript = nextDocument.getElementById("faro-main-bootstrap");
  if (!(bootstrapScript instanceof HTMLScriptElement) || !bootstrapScript.textContent) {
    return { dispose() {} };
  }

  const payload = JSON.parse(bootstrapScript.textContent) as BootstrapPayload;
  const vscode = acquireVsCodeApi();
  const bridge: MainViewBridge = {
    postMessage(message) {
      vscode.postMessage(message);
    },
  };
  const root: Root = hydrateRoot(
    rootElement,
    React.createElement(MainViewApp, {
      viewModel: payload.viewModel,
      bridge,
      interactive: true,
    }),
  );

  return {
    dispose() {
      root.unmount();
    },
  };
}

function defaultAcquireVsCodeApi(): VscodeApi {
  const candidate = (globalThis as typeof globalThis & {
    acquireVsCodeApi?: () => VscodeApi;
    window?: { acquireVsCodeApi?: () => VscodeApi };
  }).acquireVsCodeApi ??
    (globalThis as typeof globalThis & { window?: { acquireVsCodeApi?: () => VscodeApi } }).window
      ?.acquireVsCodeApi;

  if (!candidate) {
    throw new Error("acquireVsCodeApi is unavailable.");
  }

  return candidate();
}

if (typeof document !== "undefined") {
  hydrateMainView();
}
