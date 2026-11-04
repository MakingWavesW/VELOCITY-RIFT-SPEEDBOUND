import bridge, {
  EVENT_NAME,
  PLATFORM_MESSAGE,
  BANNER_POSITION,
} from "@playgama/bridge";

/** Playgama Bridge is the only ad provider; never synthesize an ad or reward. */
let ready = false;
let ad = false;
let bannerRequested = false;
let finishReward: ((completed: boolean) => void) | undefined;
let rewardObserved = false;
let safetyTimer: ReturnType<typeof setTimeout> | undefined;
let lifecycle: ((paused: boolean, audioEnabled: boolean) => void) | undefined;

function clearRewardTimer() {
  if (safetyTimer) clearTimeout(safetyTimer);
  safetyTimer = undefined;
}
function completeRewardPlayback() {
  clearRewardTimer();
  const callback = finishReward;
  finishReward = undefined;
  const complete = rewardObserved;
  rewardObserved = false;
  ad = false;
  callback?.(complete);
  lifecycle?.(ad || bridge.platform.isPaused, bridge.platform.isAudioEnabled);
}
function sync() {
  lifecycle?.(ad || bridge.platform.isPaused, bridge.platform.isAudioEnabled);
}
export const platform = {
  async initialize(onPause: (paused: boolean, audioEnabled: boolean) => void) {
    lifecycle = onPause;
    await bridge.initialize();
    ready = true;
    bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, sync);
    bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, sync);
    bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, (state: string) => {
      if (state === "loading" || state === "opened") ad = true;
      if (state === "rewarded") {
        // A browser completion callback is NOT trusted proof for the backend.
        // It only permits a subsequent server-side verification attempt.
        rewardObserved = true;
        ad = true;
      }
      if (state === "closed" || state === "failed") completeRewardPlayback();
      sync();
    });
    bridge.advertisement.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state: string) => {
      if (state === "loading" || state === "opened") ad = true;
      if (state === "closed" || state === "failed") ad = false;
      sync(); // Interstitial close must never finalize a rewarded transaction.
    });
    bridge.advertisement.on(EVENT_NAME.BANNER_STATE_CHANGED, (state: string) => {
      document.body.classList.toggle("has-platform-banner", bannerRequested && state === "shown");
    });
    sync();
  },
  async gameReady() {
    if (ready) await bridge.platform.sendMessage(PLATFORM_MESSAGE.GAME_READY);
  },
  gameplay(active: boolean) {
    if (!ready) return;
    void bridge.platform.sendMessage(
      active ? PLATFORM_MESSAGE.GAMEPLAY_STARTED : PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
    ).catch(() => {});
  },
  banner(show: boolean) {
    bannerRequested = show;
    if (!ready || bridge.platform.id === "mock" || !bridge.advertisement.isBannerSupported) {
      document.body.classList.remove("has-platform-banner");
      return;
    }
    try {
      if (show) bridge.advertisement.showBanner(BANNER_POSITION.BOTTOM, "main_menu");
      else {
        bridge.advertisement.hideBanner();
        document.body.classList.remove("has-platform-banner");
      }
    } catch (error) {
      document.body.classList.remove("has-platform-banner");
      console.warn("Playgama banner unavailable:", error);
    }
  },
  get rewardsSupported() {
    return ready && bridge.advertisement.isRewardedSupported &&
      bridge.platform.id !== "mock";
  },
  // Callback is presentation-only. The server still requires trusted S2S proof.
  showRewarded(placement: string, onClose: (completed: boolean) => void) {
    if (!this.rewardsSupported || finishReward) return false;
    finishReward = onClose;
    rewardObserved = false;
    try {
      void Promise.resolve(bridge.advertisement.showRewarded(placement))
        .catch((error) => {
          console.warn("Playgama rewarded ad failed:", error);
          if (finishReward) completeRewardPlayback();
        });
      // Failure to emit any terminal SDK event must not trap the paused game.
      clearRewardTimer();
      safetyTimer = setTimeout(() => {
        if (finishReward) completeRewardPlayback();
      }, 90000);
      return true;
    } catch (error) {
      console.warn("Playgama rewarded ad could not start:", error);
      finishReward = undefined;
      rewardObserved = false;
      clearRewardTimer();
      return false;
    }
  },
};
