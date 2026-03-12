export type RevealResult =
  | { status: "idle" }
  | { status: "revealed"; beaconId?: string }
  | { status: "missing-beacon" }
  | { status: "missing-file"; fileUri: string }
  | { status: "invalid-target"; beaconId: string }
  | { status: "unsupported-editor" };
