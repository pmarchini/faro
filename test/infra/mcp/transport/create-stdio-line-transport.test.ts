import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { createStdioLineTransport } from "../../../../src/infra/mcp/transport/create-stdio-line-transport.ts";

test("stdio line transport emits complete non-empty lines and preserves partial buffering", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const transport = createStdioLineTransport({ input, output });
  const received: string[] = [];

  const unsubscribe = transport.onMessage((line) => {
    received.push(line);
  });

  input.write("first\n");
  input.write("\n");
  input.write("sec");
  input.write("ond\nthird");
  input.write("\n");

  await flush();

  assert.deepEqual(received, ["first", "second", "third"]);

  unsubscribe();
  transport.dispose();
});

test("stdio line transport writes newline-delimited frames and stops after disposal", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const transport = createStdioLineTransport({ input, output });
  const written: string[] = [];
  const received: string[] = [];

  output.setEncoding("utf8");
  output.on("data", (chunk: string) => {
    written.push(chunk);
  });

  transport.onMessage((line) => {
    received.push(line);
  });

  transport.send("first-response");
  await flush();
  assert.deepEqual(written, ["first-response\n"]);

  transport.dispose();
  input.write("after-dispose\n");
  transport.send("ignored");
  await flush();

  assert.deepEqual(received, []);
  assert.deepEqual(written, ["first-response\n"]);
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
