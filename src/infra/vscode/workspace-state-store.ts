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
  const hydratedDocument = readStoredDocument(memento, storageKey, initialDocument);
  const store = createInMemoryStore(hydratedDocument);

  store.subscribe((document) => {
    void memento.update(storageKey, document);
  });

  return store;
}

function readStoredDocument(
  memento: MementoLike,
  storageKey: string,
  fallbackDocument: FaroDocument,
): FaroDocument {
  const storedDocument = memento.get(storageKey);

  if (!storedDocument) {
    return fallbackDocument;
  }

  try {
    assertValidDocument(storedDocument as FaroDocument);
    return storedDocument as FaroDocument;
  } catch {
    return fallbackDocument;
  }
}
