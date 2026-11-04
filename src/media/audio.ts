export type MediaState =
  | "PLATFORM_STARTUP"
  | "STUDIO_INTRO"
  | "MAIN_MENU"
  | "CONNECTING"
  | "GAMEPLAY"
  | "AD_PLAYBACK"
  | "PAUSED";
export type AudioPreferences = {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
};
export class GameAudio {
  state: MediaState = "PLATFORM_STARTUP";
  preferences: AudioPreferences = {
    master: 0.65,
    music: 0.35,
    sfx: 0.65,
    muted: false,
  };
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private beat = 0;
  private last = new Map<string, number>();
  private duckUntil = 0;
  private voices = new Set<OscillatorNode>();
  private recordedMusic?: HTMLAudioElement;
  private levelSample?: HTMLAudioElement;
  private recordedMusicReady = false;
  private levelSampleReady = false;
  private recordingsInitialized = false;
  /** Optional, licensed files in public/media. Procedural audio remains fallback. */
  private prepareRecordings() {
    if (this.recordingsInitialized) return;
    this.recordingsInitialized = true;
    const music = new Audio("/media/city-music.mp3");
    music.preload = "metadata";
    music.loop = true;
    music.addEventListener("canplay", () => {
      this.recordedMusicReady = true;
      this.sync();
    }, { once: true });
    music.addEventListener("error", () => {
      this.recordedMusicReady = false;
      if (this.recordedMusic === music) this.recordedMusic = undefined;
      this.sync();
    }, { once: true });
    this.recordedMusic = music;
    const level = new Audio("/media/level-up-sfx.mp3");
    level.preload = "auto";
    level.addEventListener("canplay", () => { this.levelSampleReady = true; }, { once: true });
    level.addEventListener("error", () => {
      this.levelSampleReady = false;
      if (this.levelSample === level) this.levelSample = undefined;
    }, { once: true });
    this.levelSample = level;
  }
  async unlock() {
    this.context ||= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.music = this.context.createGain();
      this.music.connect(this.master);
    }
    await this.context.resume();
    this.prepareRecordings();
    this.sync();
  }
  setState(state: MediaState) {
    this.state = state;
    this.sync();
  }
  configure(p: AudioPreferences) {
    this.preferences = p;
    this.sync();
  }
  private sync() {
    if (!this.context || !this.master || !this.music) return;
    const t = this.context.currentTime;
    const active = this.state === "GAMEPLAY" && !this.preferences.muted;
    if (this.recordedMusic) {
      const loudness = Math.max(0, Math.min(1,
        this.preferences.master * this.preferences.music * (performance.now() < this.duckUntil ? 0.25 : 1)));
      this.recordedMusic.volume = active && this.recordedMusicReady ? loudness : 0;
      if (active && this.recordedMusicReady) {
        if (this.recordedMusic.paused) void this.recordedMusic.play().catch(() => {});
      } else if (!this.recordedMusic.paused) {
        this.recordedMusic.pause();
      }
    }
    this.master.gain.setTargetAtTime(
      active ? this.preferences.master : 0,
      t,
      0.04,
    );
    this.music.gain.setTargetAtTime(
      this.preferences.music * (performance.now() < this.duckUntil ? 0.25 : 1),
      t,
      0.25,
    );
    if (active && !this.recordedMusicReady && !this.timer) {
      this.beat = 0;
      this.timer = setInterval(() => this.sequence(), 250);
    } else if (!active || this.recordedMusicReady) {
      clearInterval(this.timer);
      this.timer = undefined;
      for (const voice of this.voices) {
        try {
          voice.stop();
        } catch {}
      }
      this.voices.clear();
    }
  }
  private tone(
    hz: number,
    duration: number,
    volume: number,
    when = 0,
    music = false,
  ) {
    if (!this.context || !this.master || !this.music || this.voices.size >= 24)
      return;
    const t = this.context.currentTime + when,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = music ? "triangle" : "sine";
    o.frequency.value = hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(music ? this.music : this.master);
    this.voices.add(o);
    o.onended = () => {
      this.voices.delete(o);
      o.disconnect();
      g.disconnect();
    };
    o.start(t);
    o.stop(t + duration + 0.01);
  }
  // Original procedural composition: no third-party recordings or samples.
  private sequence() {
    if (this.state !== "GAMEPLAY") return;
    const roots = [130.81, 164.81, 110, 146.83],
      root = roots[Math.floor(this.beat / 16) % 4];
    const melody = [2, 3, 2.5, 4, 3, 2.5, 3, 2];
    this.tone(root, 0.22, 0.055, 0, true);
    this.tone(root * melody[this.beat % 8], 0.35, 0.035, 0.025, true);
    if (this.beat % 2 === 0) this.tone(55, 0.13, 0.08, 0, true);
    this.beat++;
    this.sync();
  }
  effect(
    kind:
      | "pickup"
      | "gem"
      | "rarePickup"
      | "jump"
      | "landing"
      | "boost"
      | "level"
      | "rebirth"
      | "equip"
      | "quest"
      | "countdown"
      | "finish"
      | "click",
  ) {
    if (this.state !== "GAMEPLAY" || this.preferences.muted) return;
    const now = performance.now(),
      cooldown = kind === "level" ? 1650 : kind === "pickup" ? 90 : 180;
    if (now - (this.last.get(kind) ?? -Infinity) < cooldown) return;
    this.last.set(kind, now);
    if (kind === "level" && this.levelSampleReady && this.levelSample) {
      this.levelSample.volume = Math.max(0, Math.min(1,
        this.preferences.master * this.preferences.sfx));
      this.levelSample.pause();
      this.levelSample.currentTime = 0;
      void this.levelSample.play().catch(() => {});
      this.duckUntil = now + 1500;
      this.sync();
      return;
    }
    const notes: Record<typeof kind, number[]> = {
      pickup: [880, 1320],
      gem: [1046, 1568],
      rarePickup: [659, 988, 1318],
      jump: [330, 500],
      landing: [110],
      boost: [220, 440, 880],
      level: [523, 659, 784, 1046],
      rebirth: [392, 523, 784, 1046],
      equip: [660, 880],
      quest: [523, 784, 1046],
      countdown: [440],
      finish: [523, 659, 784, 1046],
      click: [600],
    };
    notes[kind].forEach((n, i) =>
      this.tone(n, 0.18, this.preferences.sfx * 0.12, i * 0.075),
    );
    if (kind === "level" || kind === "rebirth") {
      this.duckUntil = now + 1500;
      this.sync();
    }
  }
  get diagnostics() {
    return {
      state: this.state,
      musicChannels: this.recordedMusicReady && this.state === "GAMEPLAY" ? 1 : this.timer ? 1 : 0,
      recordedMusic: this.recordedMusicReady,
      recordedLevel: this.levelSampleReady,
      voices: this.voices.size,
    };
  }
}
export const audio = new GameAudio();
