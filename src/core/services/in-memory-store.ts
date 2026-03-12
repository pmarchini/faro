import { createEmptyDocument, type FaroDocument, type FaroPath } from "../model/document.ts";
import { assertValidDocument } from "../model/validation.ts";
import { normalizeCurrent, setActivePath, setCurrentBeacon } from "./path-machine.ts";

type Listener = (document: FaroDocument) => void;

export type InMemoryStore = {
  load: () => FaroDocument;
  replaceDocument: (nextDocument: FaroDocument) => FaroDocument;
  subscribe: (listener: Listener) => () => void;
  upsertPath: (path: FaroPath) => FaroDocument;
  setActivePath: (pathId: string) => FaroDocument;
  setCurrentBeacon: (pathId: string, beaconId: string) => FaroDocument;
  deletePath: (pathId: string) => FaroDocument;
};

export function createInMemoryStore(
  initialDocument: FaroDocument = createEmptyDocument(),
): InMemoryStore {
  let document = structuredClone(initialDocument);
  const listeners = new Set<Listener>();

  assertValidDocument(document);

  return {
    load,
    replaceDocument,
    subscribe,
    upsertPath,
    setActivePath: setActivePathInStore,
    setCurrentBeacon: setCurrentBeaconInStore,
    deletePath,
  };

  function load(): FaroDocument {
    return structuredClone(document);
  }

  function replaceDocument(nextDocument: FaroDocument): FaroDocument {
    assertValidDocument(nextDocument);
    document = structuredClone(nextDocument);
    notify();
    return load();
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function upsertPath(path: FaroPath): FaroDocument {
    const nextDocument = load();
    const index = nextDocument.paths.findIndex((entry) => entry.id === path.id);
    const nextPath = structuredClone(path);
    nextPath.current = normalizeCurrent(nextPath);

    if (index === -1) {
      nextDocument.paths.push(nextPath);
    } else {
      nextDocument.paths[index] = nextPath;
    }

    if (nextDocument.activePathId === null) {
      nextDocument.activePathId = nextPath.id;
    }

    return replaceDocument(nextDocument);
  }

  function setActivePathInStore(pathId: string): FaroDocument {
    return replaceDocument(setActivePath(load(), pathId));
  }

  function setCurrentBeaconInStore(pathId: string, beaconId: string): FaroDocument {
    return replaceDocument(setCurrentBeacon(load(), pathId, beaconId));
  }

  function deletePath(pathId: string): FaroDocument {
    const nextDocument = load();
    nextDocument.paths = nextDocument.paths.filter((path) => path.id !== pathId);

    if (nextDocument.activePathId === pathId) {
      nextDocument.activePathId = nextDocument.paths[0]?.id ?? null;

      if (nextDocument.activePathId !== null) {
        const activePath = nextDocument.paths.find(
          (path) => path.id === nextDocument.activePathId,
        );

        if (activePath) {
          activePath.current = normalizeCurrent(activePath);
        }
      }
    }

    return replaceDocument(nextDocument);
  }

  function notify(): void {
    const snapshot = load();

    for (const listener of listeners) {
      listener(snapshot);
    }
  }
}
