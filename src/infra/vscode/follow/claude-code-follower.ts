import path from "node:path";

import {
  FOLLOW_ACK_FILE,
  FOLLOW_CONTROL_FILE,
  FOLLOW_FILE,
  parseFollowSignal,
  type FollowAction,
  type FollowControl,
  type FollowSignal,
} from "../../../core/model/follow.ts";
import { renderFollowNote } from "./follow-note.ts";

// Follows a Faro tour that is being read in Claude Code. Claude Code writes
// the reader's step to .faro/follow.json; on every change this opens the
// current beacon's file (a diff against the tour's base for a diff tour),
// highlights the step, and pins a short note. It also beats on
// .faro/ack.json so the pane knows it is paired, and writes next, back and
// step requests to .faro/control.json for Claude Code to apply. The editor
// is driven through ports so the logic is testable without VS Code.

type Disposable = {
  dispose(): void;
};

export type FollowBeaconMark = {
  line: number;
  label: string;
  isCurrent: boolean;
};

export type FollowView = {
  filePath: string;
  diffBase?: string;
  lines: Array<{ startLine: number; endLine: number }>;
  focusLine: number;
  beacons: FollowBeaconMark[];
  noteLabel: string;
  note: string;
  status: string;
  tooltip: string;
};

export type FollowPorts = {
  watch(filePath: string, onChange: () => void): Disposable;
  every(ms: number, tick: () => void): Disposable;
  readText(filePath: string): Promise<string | null>;
  writeText(filePath: string, text: string): Promise<void>;
  now(): number;
  isEnabled(): boolean;
  show(view: FollowView): Promise<void>;
  dispose(): void;
};

export type ClaudeCodeFollower = Disposable & {
  ready: Promise<void>;
  sync(): Promise<void>;
  // The step last followed, for the status bar and the step tree.
  current(): FollowSignal | null;
  onDidFollow(listener: (signal: FollowSignal) => void): Disposable;
  // Asks Claude Code to move the tour; it answers with a new follow.json.
  request(action: FollowAction, nodeId?: string): Promise<void>;
};

export const HEARTBEAT_MS = 3_000;
// A follower that has heard nothing for this long stops beating, so a
// workspace left open does not keep writing after the session ended.
const QUIET_MS = 30 * 60_000;

export function createClaudeCodeFollower({
  workspaceRoot,
  ports,
}: {
  workspaceRoot: string;
  ports: FollowPorts;
}): ClaudeCodeFollower {
  const signalPath = path.join(workspaceRoot, FOLLOW_FILE);
  const listeners = new Set<(signal: FollowSignal) => void>();
  let lastSeen: number | null = null;
  let followed: FollowSignal | null = null;
  let followedAt = 0;
  let requests = 0;
  let queue = Promise.resolve();

  async function readSignal(): Promise<FollowSignal | null> {
    const text = await ports.readText(signalPath);
    return text === null ? null : parseFollowSignal(text);
  }

  function rootOf(signal: FollowSignal): string {
    return signal.root && path.isAbsolute(signal.root) ? signal.root : workspaceRoot;
  }

  async function beat(): Promise<void> {
    if (!followed || !ports.isEnabled() || ports.now() - followedAt > QUIET_MS) {
      return;
    }

    const ack = { version: 1, updatedAt: followed.updatedAt, at: ports.now() };
    await ports.writeText(path.join(rootOf(followed), FOLLOW_ACK_FILE), `${JSON.stringify(ack)}\n`);
  }

  async function syncNow(): Promise<void> {
    const signal = await readSignal();

    if (!signal || signal.updatedAt === lastSeen) {
      return;
    }

    lastSeen = signal.updatedAt;

    if (!ports.isEnabled()) {
      return;
    }

    followed = signal;
    followedAt = ports.now();
    await ports.show(createFollowView(signal, workspaceRoot));
    await beat();

    for (const listener of listeners) {
      listener(signal);
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
  const heartbeat = ports.every(HEARTBEAT_MS, () => {
    void beat().catch(() => undefined);
  });

  return {
    ready,
    sync: () => ready.then(sync),
    current: () => followed,
    onDidFollow(listener) {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
    async request(action, nodeId) {
      if (!followed) {
        return;
      }

      requests += 1;
      const control: FollowControl = {
        version: 1,
        id: `${ports.now()}-${requests}`,
        tourId: followed.tourId,
        action,
        ...(nodeId ? { nodeId } : {}),
      };
      await ports.writeText(path.join(rootOf(followed), FOLLOW_CONTROL_FILE), `${JSON.stringify(control)}\n`);
    },
    dispose() {
      watcher.dispose();
      heartbeat.dispose();
      listeners.clear();
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
  const beacons = (signal.beacons ?? [])
    .map((beacon, index) => ({ ...beacon, isCurrent: index === signal.beaconIndex }))
    .filter((beacon) => beacon.file === file)
    .map(({ line, label, isCurrent }) => ({ line, label, isCurrent }));

  return {
    filePath: path.resolve(root, file),
    ...(signal.diffBase ? { diffBase: signal.diffBase } : {}),
    lines,
    focusLine,
    beacons,
    noteLabel: `faro · ${signal.step} ${signal.title}`,
    note: renderFollowNote(signal),
    status: `faro ${signal.step}/${signal.total}`,
    tooltip: `${signal.tourTitle}\n${signal.step}. ${signal.title}\nFollowing the tour in Claude Code (faro.followClaudeCode).`,
  };
}
