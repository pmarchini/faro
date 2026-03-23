import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

type BuildOptions = {
  workspaceRoot?: string;
  outDir?: string;
};

export async function buildVscodeAssets({
  workspaceRoot = process.cwd(),
  outDir = path.join(workspaceRoot, "dist"),
}: BuildOptions = {}): Promise<void> {
  const extensionOutDir = path.join(outDir, "extension");
  const webviewOutDir = path.join(outDir, "webviews", "main");
  const extensionEntry = path.join(workspaceRoot, "src", "infra", "vscode", "extension.ts");
  const webviewEntry = path.join(
    workspaceRoot,
    "src",
    "infra",
    "vscode",
    "ui",
    "main-view",
    "main-view-browser.ts",
  );
  const webviewCssEntry = path.join(
    workspaceRoot,
    "src",
    "infra",
    "vscode",
    "ui",
    "main-view",
    "main-view.css",
  );

  await Promise.all([
    rm(extensionOutDir, { recursive: true, force: true }),
    rm(path.join(outDir, "webviews"), { recursive: true, force: true }),
  ]);

  await Promise.all([
    mkdir(extensionOutDir, { recursive: true }),
    mkdir(webviewOutDir, { recursive: true }),
  ]);

  await Promise.all([
    esbuild.build({
      entryPoints: [extensionEntry],
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node20",
      external: ["vscode"],
      outfile: path.join(extensionOutDir, "extension.cjs"),
      sourcemap: true,
      legalComments: "none",
      logLevel: "silent",
    }),
    esbuild.build({
      entryPoints: [webviewEntry],
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2020",
      outfile: path.join(webviewOutDir, "index.js"),
      sourcemap: true,
      legalComments: "none",
      logLevel: "silent",
    }),
    esbuild.build({
      entryPoints: [webviewCssEntry],
      bundle: true,
      outfile: path.join(webviewOutDir, "index.css"),
      sourcemap: true,
      legalComments: "none",
      logLevel: "silent",
    }),
  ]);
}

async function main(): Promise<void> {
  await buildVscodeAssets();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
