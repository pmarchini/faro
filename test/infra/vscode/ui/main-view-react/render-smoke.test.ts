import assert from "node:assert/strict";
import test from "node:test";

import React from "react";

import { installDomTestEnvironment } from "./dom-test-environment.ts";

test("the isolated UI harness can render a React component", async () => {
  const dom = installDomTestEnvironment();

  try {
    const { render, cleanup } = await import("@testing-library/react");
    const result = render(React.createElement("div", null, "Faro harness ready"));

    assert.equal(result.getByText("Faro harness ready").textContent, "Faro harness ready");
    cleanup();
  } finally {
    dom.dispose();
  }
});
