import bridge, {
  EVENT_NAME,
  PLATFORM_MESSAGE,
  BANNER_POSITION,
} from "@playgama/bridge";
let ready = false;
let ad = false;
let resume = () => {};
export const platform = {
  async initialize(onPause: (paused: boolean, audioEnabled: boolean) => void) {
    await bridge.initialize();
    ready = true;
    const sync = () =>
      onPause(ad || bridge.platform.isPaused, bridge.platform.isAudioEnabled);
    bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, sync);
    bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, sync);
    for (const event of [
      EVENT_NAME.REWARDED_STATE_CHANGED,
      EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
    ])
      bridge.advertisement.on(event, (state: string) => {
        if (state === "loading" || state === "opened") ad = true;
        if (state === "closed" || state === "failed") {
          ad = false;
          resume();
        }
        sync();
      });
    sync();
  },
  async gameReady() {
    if (ready) await bridge.platform.sendMessage(PLATFORM_MESSAGE.GAME_READY);
  },
  gameplay(active: boolean) {
    if (!ready) return;
    void bridge.platform
      .sendMessage(
        active
          ? PLATFORM_MESSAGE.GAMEPLAY_STARTED
          : PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
      )
      .catch(() => {});
  },
  banner(show: boolean) {
    if (
      !ready ||
      !bridge.advertisement.isBannerSupported ||
      bridge.platform.id === "mock"
    )
      return;
    if (show) bridge.advertisement.showBanner(BANNER_POSITION.BOTTOM);
    else bridge.advertisement.hideBanner();
    document.body.classList.toggle("has-platform-banner", show);
  },
  get rewardsSupported() {
    return (
      ready &&
      bridge.advertisement.isRewardedSupported &&
      bridge.platform.id !== "mock"
    );
  },
  // Browser reward events are presentation signals only. The server never accepts them as proof.
  showRewarded(placement: string, onClose: () => void) {
    if (!this.rewardsSupported) return false;
    resume = onClose;
    bridge.advertisement.showRewarded(placement);
    return true;
  },
};
