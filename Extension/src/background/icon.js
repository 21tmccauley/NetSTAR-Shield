import { ICON_STATES, ICON_THRESHOLDS } from "./constants.js";

/**
 * Browser action icon state
 */
export function updateIcon(tabId, safetyScore) {
  let iconState = ICON_STATES.SAFE;

  if (safetyScore >= ICON_THRESHOLDS.SAFE) {
    iconState = ICON_STATES.SAFE;
  } else if (safetyScore >= ICON_THRESHOLDS.WARNING) {
    iconState = ICON_STATES.WARNING;
  } else {
    iconState = ICON_STATES.DANGER;
  }

  const iconPath = (size) => `src/icons/icon-${iconState}-${size}.png`;

  chrome.action.setIcon({
    tabId,
    path: {
      16: iconPath(16),
      48: iconPath(48),
      128: iconPath(128),
    },
  });
}

