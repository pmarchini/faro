import { createInterface, type Interface } from "node:readline";

type Disposable = {
  dispose(): void;
};

export type StdioLineTransport = Disposable & {
  onMessage(listener: (line: string) => void): () => void;
  send(line: string): void;
};

export function createStdioLineTransport({
  input,
  output,
}: {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}): StdioLineTransport {
  const listeners = new Set<(line: string) => void>();
  const lineReader = createInterface({
    input,
    crlfDelay: Infinity,
  });
  let disposed = false;

  lineReader.on("line", handleLine);

  return {
    onMessage(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    send(line) {
      if (disposed) {
        return;
      }

      output.write(`${line}\n`);
    },
    dispose,
  };

  function handleLine(line: string): void {
    if (disposed) {
      return;
    }

    const normalized = line.trim();

    if (normalized.length === 0) {
      return;
    }

    for (const listener of listeners) {
      listener(normalized);
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    listeners.clear();
    lineReader.removeListener("line", handleLine);
    safelyClose(lineReader);
  }
}

function safelyClose(lineReader: Interface): void {
  try {
    lineReader.close();
  } catch {
    // `readline.Interface#close()` can throw if the input is already closed.
  }
}
