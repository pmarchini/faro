type Disposable = {
  dispose(): void;
};

export type ExtensionRuntime = Disposable & {
  readonly status: "ready";
};

export function createExtensionRuntime(): ExtensionRuntime {
  return {
    status: "ready",
    dispose() {
      // The composition root stays intentionally empty until commands and views land.
    },
  };
}
