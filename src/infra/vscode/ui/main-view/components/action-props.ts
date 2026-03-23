import type { SetupScope, SetupTargetId } from "../../../../../setup/setup-contract.ts";
import type { MainMessage, MainViewBridge } from "../main-view-contract.ts";

export type ActionConfig = {
  action: string;
  onClickMessage?: MainMessage;
  pathId?: string;
  pathTitle?: string;
  beaconId?: string;
  scope?: SetupScope;
  targetId?: SetupTargetId;
};

export function createActionProps(
  action: ActionConfig,
  bridge: MainViewBridge | undefined,
  interactive: boolean,
) {
  const props: Record<string, string | (() => void)> = {
    "data-action": action.action,
  };

  if (action.pathId) {
    props["data-path-id"] = action.pathId;
  }
  if (action.pathTitle) {
    props["data-path-title"] = action.pathTitle;
  }
  if (action.beaconId) {
    props["data-beacon-id"] = action.beaconId;
  }
  if (action.scope) {
    props["data-scope"] = action.scope;
  }
  if (action.targetId) {
    props["data-target-id"] = action.targetId;
  }

  if (interactive && bridge && action.onClickMessage) {
    props.onClick = () => {
      bridge.postMessage(action.onClickMessage as MainMessage);
    };
  }

  return props;
}
