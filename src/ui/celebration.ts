import { audio } from "../media/audio";
export class LevelCelebration {
  private previous?: number;
  private timer?: ReturnType<typeof setTimeout>;
  private element?: HTMLElement;
  reset() {
    this.previous = undefined;
    clearTimeout(this.timer);
    this.element?.remove();
    this.element = undefined;
  }
  snapshot(level: number, reduced: boolean) {
    const old = this.previous;
    this.previous = level;
    if (old === undefined || level <= old) return;
    if (!this.element) {
      this.element = document.createElement("aside");
      this.element.id = "levelCelebration";
      this.element.setAttribute("role", "status");
      this.element.innerHTML =
        '<img src="/media/level-up.png" alt="Level up"><strong></strong><div class="level-sparks" aria-hidden="true">✦ · ✧ · ✦</div>';
      document.body.append(this.element);
      audio.effect("level");
    }
    this.element.classList.toggle("reduced", reduced);
    this.element.querySelector("strong")!.textContent = `LEVEL ${level}`;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.element?.remove();
      this.element = undefined;
    }, 1650);
  }
}
