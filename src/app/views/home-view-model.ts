import type { FaroDocument, FaroPath } from "../../core/model/document.ts";

export type HomeViewModel = {
  title: string;
  message: string;
  resumeLabel: string;
  currentPathTitle: string;
  currentPathSummary: string;
  setupLabel: string;
  setupSummary: string;
};

export function buildHomeViewModel(document: FaroDocument | null | undefined): HomeViewModel {
  const activePath = findActivePath(document);

  return {
    title: "Faro",
    message: "One entry point for paths and setup inside VS Code.",
    resumeLabel: "Resume Current Path",
    currentPathTitle: activePath?.title ?? activePath?.id ?? "No active path",
    currentPathSummary:
      activePath?.goal ?? "Create a Faro path to start a guided code-reading spine.",
    setupLabel: "Open Setup",
    setupSummary: "Check local or global Claude, Copilot, and Codex integration status.",
  };
}

function findActivePath(document: FaroDocument | null | undefined): FaroPath | null {
  const paths = Array.isArray(document?.paths) ? document.paths : [];
  return paths.find((path) => path.id === document?.activePathId) ?? null;
}

