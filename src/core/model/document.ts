export type BeaconRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type Beacon = {
  id: string;
  title?: string;
  fileUri: string;
  range: BeaconRange;
  summary?: string;
  explanation?: string;
  tags?: string[];
  children?: string[];
};

export type PathPointer = {
  mode: "main";
  index: number;
  beaconId: string | null;
};

export type FaroPath = {
  id: string;
  title?: string;
  goal?: string;
  mainPath: string[];
  branches?: unknown[];
  current?: PathPointer;
  beacons: Record<string, Beacon>;
};

export type FaroDocument = {
  schemaVersion: 1;
  activePathId: string | null;
  paths: FaroPath[];
};

export function createEmptyDocument(): FaroDocument {
  return {
    schemaVersion: 1,
    activePathId: null,
    paths: [],
  };
}
