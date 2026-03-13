import type { FaroDocument } from "../../core/model/document.ts";
import { assertValidDocument } from "../../core/model/validation.ts";
import { createInMemoryStore, type InMemoryStore } from "../../core/services/in-memory-store.ts";

type MementoLike = {
  get(key: string): unknown;
  update(key: string, value: FaroDocument): Promise<void>;
};

type Options = {
  memento: MementoLike;
  initialDocument: FaroDocument;
  storageKey?: string;
};

export function createWorkspaceStateStore({
  memento,
  initialDocument,
  storageKey = "faro.document",
}: Options): InMemoryStore {
  const { document: hydratedDocument, didMigrate } = readStoredDocument(
    memento,
    storageKey,
    initialDocument,
  );
  const store = createInMemoryStore(hydratedDocument);

  if (didMigrate) {
    void memento.update(storageKey, hydratedDocument);
  }

  store.subscribe((document) => {
    void memento.update(storageKey, document);
  });

  return store;
}

function readStoredDocument(
  memento: MementoLike,
  storageKey: string,
  fallbackDocument: FaroDocument,
): { document: FaroDocument; didMigrate: boolean } {
  const storedDocument = memento.get(storageKey);

  if (!storedDocument) {
    return {
      document: fallbackDocument,
      didMigrate: false,
    };
  }

  try {
    assertValidDocument(storedDocument as FaroDocument);
    const migratedDocument = migratePlaceholderWorkspaceUris(
      storedDocument as FaroDocument,
      fallbackDocument,
    );

    return {
      document: migratedDocument,
      didMigrate: JSON.stringify(migratedDocument) !== JSON.stringify(storedDocument),
    };
  } catch {
    return {
      document: fallbackDocument,
      didMigrate: false,
    };
  }
}

function migratePlaceholderWorkspaceUris(
  storedDocument: FaroDocument,
  fallbackDocument: FaroDocument,
): FaroDocument {
  const nextDocument = structuredClone(storedDocument);

  for (const path of nextDocument.paths) {
    const fallbackPath = fallbackDocument.paths.find((entry) => entry.id === path.id);

    if (!fallbackPath) {
      continue;
    }

    for (const [beaconId, beacon] of Object.entries(path.beacons)) {
      if (!beacon.fileUri.startsWith("file:///workspace/")) {
        continue;
      }

      const fallbackBeacon = fallbackPath.beacons[beaconId];

      if (!fallbackBeacon) {
        continue;
      }

      beacon.fileUri = fallbackBeacon.fileUri;
    }
  }

  return nextDocument;
}
