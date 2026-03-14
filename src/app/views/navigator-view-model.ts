import type { FaroDocument, FaroPath } from "../../core/model/document.ts";

export type NavigatorBeaconListItem = {
  id: string;
  title: string;
  summary: string;
  stepNumber: number;
  isCurrent: boolean;
};

export type EmptyNavigatorViewModel = {
  state: "empty";
  title: string;
  message: string;
  canGoPrevious: false;
  canGoNext: false;
};

export type ReadyNavigatorViewModel = {
  state: "ready";
  pathId: string;
  pathTitle: string;
  goal: string;
  currentStepNumber: number;
  beaconCount: number;
  beaconId: string;
  beaconTitle: string;
  summary: string;
  explanation: string;
  tags: string[];
  positionLabel: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  beacons: NavigatorBeaconListItem[];
};

export type NavigatorViewModel = EmptyNavigatorViewModel | ReadyNavigatorViewModel;

export function buildNavigatorViewModel(
  document: FaroDocument | null | undefined,
): NavigatorViewModel {
  const activePath = findActivePath(document);

  if (!activePath) {
    return {
      state: "empty",
      title: "No active path",
      message: "Ask an agent to create a Faro path to get started.",
      canGoPrevious: false,
      canGoNext: false,
    };
  }

  const currentBeaconId = activePath.current?.beaconId;
  const beacon = currentBeaconId ? activePath.beacons?.[currentBeaconId] : null;
  const position = activePath.current?.index ?? 0;
  const total = activePath.mainPath.length;

  if (!beacon || !currentBeaconId) {
    return {
      state: "empty",
      title: "Current beacon unavailable",
      message: "The active path does not have a valid current beacon.",
      canGoPrevious: false,
      canGoNext: false,
    };
  }

  return {
    state: "ready",
    pathId: activePath.id,
    pathTitle: activePath.title ?? activePath.id,
    goal: activePath.goal ?? "",
    currentStepNumber: Math.min(position + 1, Math.max(total, 1)),
    beaconCount: Math.max(total, 1),
    beaconId: currentBeaconId,
    beaconTitle: beacon.title ?? currentBeaconId,
    summary: beacon.summary ?? "",
    explanation: beacon.explanation ?? "",
    tags: Array.isArray(beacon.tags) ? beacon.tags : [],
    positionLabel: `${Math.min(position + 1, Math.max(total, 1))} of ${Math.max(total, 1)}`,
    canGoPrevious: position > 0,
    canGoNext: position < total - 1,
    beacons: activePath.mainPath.map((beaconId, index) => ({
      id: beaconId,
      title: activePath.beacons?.[beaconId]?.title ?? beaconId,
      summary: activePath.beacons?.[beaconId]?.summary ?? "",
      stepNumber: index + 1,
      isCurrent: beaconId === currentBeaconId,
    })),
  };
}

function findActivePath(document: FaroDocument | null | undefined): FaroPath | null {
  const paths = Array.isArray(document?.paths) ? document.paths : [];
  return paths.find((path) => path.id === document?.activePathId) ?? null;
}
