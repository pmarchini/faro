import { buildOutlineTreeModel, type BeaconItem, type PathItem } from "../../../../app/views/outline-tree-model.ts";
import type { InMemoryStore } from "../../../../core/services/in-memory-store.ts";

export type OutlineTreeElement = PathItem | BeaconItem;

type OutlineCommand = {
  command: string;
  title: string;
  arguments: unknown[];
};

export type OutlineTreeItem = {
  label: string;
  description: string;
  collapsibleState: 0 | 1 | 2;
  contextValue: "path" | "beacon" | "current-beacon";
  command?: OutlineCommand;
};

type ChangeListener = () => void;

type Disposable = {
  dispose(): void;
};

type OutlineStore = Pick<InMemoryStore, "load">;

export function createOutlineTreeProvider({ store }: { store: OutlineStore }) {
  const listeners = new Set<ChangeListener>();

  return {
    dispose,
    getChildren,
    getTreeItem,
    onDidChangeTreeData,
    refresh: emitChange,
  };

  function dispose(): void {
    listeners.clear();
  }

  function getChildren(element?: OutlineTreeElement): OutlineTreeElement[] {
    if (!element) {
      return buildOutlineTreeModel(store.load());
    }

    if (element.type === "path") {
      return element.children;
    }

    return [];
  }

  function getTreeItem(element: OutlineTreeElement): OutlineTreeItem {
    if (element.type === "path") {
      return {
        label: element.title,
        description: element.description,
        collapsibleState: toCollapsibleState(element.collapsibleState),
        contextValue: "path",
        command: toOutlineCommand(element.command, "Faro: Set Active Path"),
      };
    }

    return {
      label: element.title,
      description: element.description,
      collapsibleState: 0,
      contextValue: element.isCurrent ? "current-beacon" : "beacon",
      command: toOutlineCommand(element.command, "Faro: Set Current Beacon"),
    };
  }

  function onDidChangeTreeData(listener: ChangeListener): Disposable {
    listeners.add(listener);

    return {
      dispose() {
        listeners.delete(listener);
      },
    };
  }

  function emitChange(): void {
    for (const listener of listeners) {
      listener();
    }
  }
}

function toCollapsibleState(value: PathItem["collapsibleState"]): 1 | 2 {
  return value === "expanded" ? 2 : 1;
}

function toOutlineCommand(
  command: PathItem["command"] | BeaconItem["command"],
  title: string,
): OutlineCommand {
  return {
    command: command.id,
    title,
    arguments: command.arguments,
  };
}
