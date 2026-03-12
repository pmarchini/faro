import type { FaroDocument, FaroPath } from "../../core/model/document.ts";

export type BeaconItem = {
  type: "beacon";
  id: string;
  beaconId: string;
  parentPathId: string;
  title: string;
  description: string;
  isCurrent: boolean;
  command: {
    id: "faro.setCurrentBeacon";
    arguments: [string, string];
  };
};

export type PathItem = {
  type: "path";
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  collapsibleState: "expanded" | "collapsed";
  command: {
    id: "faro.setActivePath";
    arguments: [string];
  };
  children: BeaconItem[];
};

export function buildOutlineTreeModel(document: FaroDocument | null | undefined): PathItem[] {
  const paths = Array.isArray(document?.paths) ? document.paths : [];
  return paths.map((path) => buildPathItem(path, document?.activePathId ?? null));
}

function buildPathItem(path: FaroPath, activePathId: string | null): PathItem {
  const currentBeaconId = path.current?.beaconId ?? null;
  const beaconIds = Array.isArray(path.mainPath) ? path.mainPath : [];

  return {
    type: "path",
    id: path.id,
    title: path.title ?? path.id,
    description: path.goal ?? "",
    isActive: path.id === activePathId,
    collapsibleState: path.id === activePathId ? "expanded" : "collapsed",
    command: {
      id: "faro.setActivePath",
      arguments: [path.id],
    },
    children: beaconIds.map((beaconId) =>
      buildBeaconItem(path, beaconId, beaconId === currentBeaconId),
    ),
  };
}

function buildBeaconItem(path: FaroPath, beaconId: string, isCurrent: boolean): BeaconItem {
  const beacon = path.beacons?.[beaconId] ?? {};

  return {
    type: "beacon",
    id: beaconId,
    beaconId,
    parentPathId: path.id,
    title: beacon.title ?? beaconId,
    description: beacon.summary ?? "",
    isCurrent,
    command: {
      id: "faro.setCurrentBeacon",
      arguments: [path.id, beaconId],
    },
  };
}
