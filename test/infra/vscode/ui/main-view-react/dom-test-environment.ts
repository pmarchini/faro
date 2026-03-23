// @ts-expect-error jsdom is available at runtime but is untyped in this repo.
import { JSDOM } from "jsdom";

type Disposable = {
  dispose(): void;
};

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLScriptElement",
  "Node",
  "Text",
  "Event",
  "MouseEvent",
  "CustomEvent",
  "getComputedStyle",
] as const;

type GlobalKey = (typeof GLOBAL_KEYS)[number];

export function installDomTestEnvironment(): Disposable {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const previous = new Map<GlobalKey, unknown | undefined>();
  const globalObject = globalThis as typeof globalThis & Record<GlobalKey, unknown>;

  for (const key of GLOBAL_KEYS) {
    previous.set(key, globalObject[key]);
  }

  defineGlobal("window", dom.window);
  defineGlobal("document", dom.window.document);
  defineGlobal("navigator", dom.window.navigator);
  defineGlobal("HTMLElement", dom.window.HTMLElement);
  defineGlobal("HTMLScriptElement", dom.window.HTMLScriptElement);
  defineGlobal("Node", dom.window.Node);
  defineGlobal("Text", dom.window.Text);
  defineGlobal("Event", dom.window.Event);
  defineGlobal("MouseEvent", dom.window.MouseEvent);
  defineGlobal("CustomEvent", dom.window.CustomEvent);
  defineGlobal("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));

  return {
    dispose() {
      dom.window.close();

      for (const key of GLOBAL_KEYS) {
        const value = previous.get(key);

        if (value === undefined) {
          Reflect.deleteProperty(globalObject, key);
          continue;
        }

        Object.defineProperty(globalObject, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        });
      }
    },
  };

  function defineGlobal(key: GlobalKey, value: unknown): void {
    Object.defineProperty(globalObject, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    });
  }
}
