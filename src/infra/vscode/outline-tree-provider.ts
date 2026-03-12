import { buildOutlineTreeModel, type BeaconItem, type PathItem } from "../../app/views/outline-tree-model.ts";
import type { InMemoryStore } from "../../core/services/in-memory-store.ts";

export type OutlineTreeElement = PathItem | BeaconItem;

export type OutlineTreeItem = {
  label: string;
  description: string;
  collapsibleState: "expanded" | "collapsed" | "none";
  contextValue: "path" | "beacon" | "current-beacon";
  command?: PathItem["command"] | BeaconItem["command"];
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
        collapsibleState: element.collapsibleState,
        contextValue: "path",
        command: element.command,
      };
    }

    return {
      label: element.title,
      description: element.description,
      collapsibleState: "none",
      contextValue: element.isCurrent ? "current-beacon" : "beacon",
      command: element.command,
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
