import path from "node:path";

import { FOLLOW_FILE, parseFollowSignal, type FollowSignal } from "../../../core/model/follow.ts";
import { renderFollowNote } from "./follow-note.ts";

// Follows a Faro tour that is being read in Claude Code: the Claude Code
// plugin writes the reader's step to .faro/follow.json, and on every change
// this opens that step's file beside the reader, highlights its anchors and
// beacon, and shows the step in the status bar. The editor is driven through
// ports so the logic is testable without VS Code.

type Disposable = {
  dispose(): void;
};

export type FollowView = {
  filePath: string;
  lines: Array<{ startLine: number; endLine: number }>;
  focusLine: number;
  beaconLabel?: string;
  note: string;
  status: string;
  tooltip: string;
};

export type FollowPorts = {
  watch(filePath: string, onChange: () => void): Disposable;
  readText(filePath: string): Promise<string | null>;
  isEnabled(): boolean;
  show(view: FollowView): Promise<void>;
  dispose(): void;
};

export type ClaudeCodeFollower = Disposable & {
  ready: Promise<void>;
  sync(): Promise<void>;
};

export function createClaudeCodeFollower({
  workspaceRoot,
  ports,
}: {
  workspaceRoot: string;
  ports: FollowPorts;
}): ClaudeCodeFollower {
  const signalPath = path.join(workspaceRoot, FOLLOW_FILE);
  let lastSeen: number | null = null;
  let queue = Promise.resolve();

  async function readSignal(): Promise<FollowSignal | null> {
    const text = await ports.readText(signalPath);
    return text === null ? null : parseFollowSignal(text);
  }

  async function syncNow(): Promise<void> {
    const signal = await readSignal();

    if (!signal || signal.updatedAt === lastSeen) {
      return;
    }

    lastSeen = signal.updatedAt;

    if (ports.isEnabled()) {
      await ports.show(createFollowView(signal, workspaceRoot));
    }
  }

  // Changes are applied one at a time and in order, so a fast j j j in the
  // pane cannot land an older step after a newer one.
  function sync(): Promise<void> {
    queue = queue.then(syncNow).catch(() => undefined);
    return queue;
  }

  // A step left over from an earlier session is not followed: only the steps
  // taken while VS Code is open are.
  const ready = readSignal()
    .then((signal) => {
      lastSeen = signal?.updatedAt ?? null;
    })
    .catch(() => undefined);
  const watcher = ports.watch(signalPath, () => {
    void ready.then(sync);
  });

  return {
    ready,
    sync: () => ready.then(sync),
    dispose() {
      watcher.dispose();
      ports.dispose();
    },
  };
}

export function createFollowView(signal: FollowSignal, workspaceRoot: string): FollowView {
  const root = signal.root && path.isAbsolute(signal.root) ? signal.root : workspaceRoot;
  const file = signal.focus?.file ?? signal.anchors[0]!.file;
  const lines = signal.anchors
    .filter((anchor) => anchor.file === file)
    .map((anchor) => ({ startLine: anchor.range.startLine, endLine: anchor.range.endLine }));
  const focusLine = signal.focus?.line ?? lines[0]?.startLine ?? 1;

  return {
    filePath: path.resolve(root, file),
    lines,
    focusLine,
    beaconLabel: signal.note?.beacon?.label,
    note: renderFollowNote(signal),
    status: `Faro ${signal.step}/${signal.total} · ${signal.title}`,
    tooltip: `${signal.tourTitle}\n${signal.summary}\nFollowing the tour in Claude Code (faro.followClaudeCode).`,
  };
}
