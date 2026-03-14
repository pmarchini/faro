export type SetupScope = "local" | "global";

export type SetupTargetId =
  | "claude"
  | "copilotInstructions"
  | "copilotAgent"
  | "codexSkill";

export type SetupTargetStatus = "missing" | "installed";

export type SetupTargetSnapshot = {
  id: SetupTargetId;
  status: SetupTargetStatus;
};

export type SetupStateSnapshot = {
  scope: SetupScope;
  isLoading: boolean;
  targets: SetupTargetSnapshot[];
  feedback?: {
    kind: "success" | "error";
    message: string;
  };
};
