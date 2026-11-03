/** Accumulates active gameplay time; defers offers until the player is grounded and calm. */
export class OfferTiming {
  elapsed = 0;
  sincePopup = 60_000;
  update(ms: number, playing: boolean, calm: boolean, popupOpen: boolean) {
    if (!playing) return false;
    this.elapsed += Math.max(0, ms);
    this.sincePopup += Math.max(0, ms);
    if (popupOpen) {
      this.sincePopup = 0;
      return false;
    }
    if (this.elapsed < 60_000 || this.sincePopup < 15_000 || !calm)
      return false;
    this.elapsed = 0;
    this.sincePopup = 0;
    return true;
  }
  reset() {
    this.elapsed = 0;
    this.sincePopup = 60_000;
  }
}
