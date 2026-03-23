import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { buildVscodeAssets } from "../../scripts/build-vscode-assets.ts";

test("buildVscodeAssets writes bundled extension and webview assets", async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(directory, "../..");
  const outDir = await mkdtemp(path.join(tmpdir(), "faro-build-vscode-assets-"));

  await buildVscodeAssets({
    workspaceRoot,
    outDir,
  });

  const extensionJs = await readFile(path.join(outDir, "extension", "extension.cjs"), "utf8");
  const webviewJs = await readFile(path.join(outDir, "webviews", "main", "index.js"), "utf8");
  const webviewCss = await readFile(path.join(outDir, "webviews", "main", "index.css"), "utf8");

  assert.match(extensionJs, /activate/);
  assert.match(extensionJs, /module\.exports|exports\./);
  assert.match(webviewJs, /hydrateMainView/);
  assert.match(webviewJs, /faro-main-bootstrap/);
  assert.match(webviewCss, /faro-main-webview-bundle/);
});
