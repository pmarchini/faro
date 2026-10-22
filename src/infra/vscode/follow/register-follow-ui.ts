import type { FollowSignal } from "../../../core/model/follow.ts";
import type { VscodeLike, VscodeStatusBarItem } from "../vscode-api.ts";
import type { ClaudeCodeFollower } from "./claude-code-follower.ts";

type Disposable = {
  dispose(): void;
};

export const FOLLOW_COMMANDS = {
  next: "faro.follow.next",
  back: "faro.follow.back",
  step: "faro.follow.step",
} as const;

export const FOLLOW_TOUR_VIEW = "faro.followTour";

type StepItem = { nodeId: string; title: string; position: number; isCurrent: boolean };

// The controls VS Code adds while it follows a tour: ‹ faro 3/6 › in the
// status bar, faro.follow.next/back (alt+] and alt+[), and the step list in
// the Explorer. Every one of them only asks Claude Code to move; the editor
// changes when Claude Code answers through follow.json.
export function registerFollowUi({
  vscode,
  follower,
}: {
  vscode: VscodeLike;
  follower: ClaudeCodeFollower;
}): Disposable {
  const steps = createFollowStepTree(follower);
  const statusItems = createStatusItems(vscode);
  const disposables: Disposable[] = [
    vscode.commands.registerCommand(FOLLOW_COMMANDS.next, () => follower.request("next")),
    vscode.commands.registerCommand(FOLLOW_COMMANDS.back, () => follower.request("previous")),
    vscode.commands.registerCommand(FOLLOW_COMMANDS.step, (nodeId) =>
      typeof nodeId === "string" ? follower.request("step", nodeId) : undefined,
    ),
    vscode.window.registerTreeDataProvider(FOLLOW_TOUR_VIEW, steps),
    follower.onDidFollow((signal) => {
      void vscode.commands.executeCommand("setContext", "faro.following", true);
      statusItems?.show(signal);
      steps.refresh();
    }),
  ];

  return {
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }

      statusItems?.dispose();
      steps.dispose();
    },
  };
}

function createStatusItems(vscode: VscodeLike) {
  const create = (priority: number, text: string, command: string, tooltip: string): VscodeStatusBarItem | undefined => {
    const item = vscode.window.createStatusBarItem?.(vscode.StatusBarAlignment?.Left, priority);

    if (item) {
      item.text = text;
      item.command = command;
      item.tooltip = tooltip;
    }

    return item;
  };
  const back = create(102, "$(chevron-left)", FOLLOW_COMMANDS.back, "Faro: previous step (alt+[)");
  const step = create(101, "faro", FOLLOW_COMMANDS.next, "");
  const next = create(100, "$(chevron-right)", FOLLOW_COMMANDS.next, "Faro: next step (alt+])");

  if (!back || !step || !next) {
    return null;
  }

  return {
    show(signal: FollowSignal) {
      step.text = `faro ${signal.step}/${signal.total}`;
      step.tooltip = `${signal.tourTitle}\n${signal.step}. ${signal.title}`;

      for (const item of [back, step, next]) {
        item.show();
      }
    },
    dispose() {
      for (const item of [back, step, next]) {
        item.dispose();
      }
    },
  };
}

export function createFollowStepTree(follower: Pick<ClaudeCodeFollower, "current">) {
  const listeners = new Set<() => void>();

  return {
    getChildren(element?: StepItem): StepItem[] {
      const signal = follower.current();

      if (element || !signal) {
        return [];
      }

      return (signal.steps ?? []).map((step, index) => ({
        ...step,
        position: index + 1,
        isCurrent: step.nodeId === signal.nodeId,
      }));
    },
    getTreeItem(element: StepItem) {
      return {
        label: `${element.isCurrent ? "▸" : " "} ${element.position} ${element.title}`,
        collapsibleState: 0 as const,
        contextValue: element.isCurrent ? "current-step" : "step",
        command: { command: FOLLOW_COMMANDS.step, title: "Faro: Go to Step", arguments: [element.nodeId] },
      };
    },
    onDidChangeTreeData(listener: () => void): Disposable {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
    refresh() {
      for (const listener of listeners) {
        listener();
      }
    },
    dispose() {
      listeners.clear();
    },
  };
}
