import { angleDelta, move, speed, type Player } from "../../shared/game";
export const NETWORK = Object.freeze({
  interpolationMs: 120,
  extrapolationMs: 100,
  hardCorrection: 4,
  correctionRate: 16,
  maxPending: 12,
});
type Sample = { time: number; player: Player };
export class SnapshotBuffer {
  samples: Sample[] = [];
  push(time: number, player: Player) {
    const last = this.samples.at(-1);
    if (last && time <= last.time) return false;
    const teleport =
      !!last &&
      Math.hypot(
        player.x - last.player.x,
        player.y - last.player.y,
        player.z - last.player.z,
      ) > Math.max(8, (time - last.time) * 0.045);
    if (teleport) this.samples = [];
    this.samples.push({ time, player: { ...player } });
    if (this.samples.length > 32) this.samples.shift();
    return teleport;
  }
  sample(time: number): Player | undefined {
    const samples = this.samples;
    if (!samples.length) return;
    if (time <= samples[0].time) return { ...samples[0].player };
    for (let n = 1; n < samples.length; n++) {
      const a = samples[n - 1],
        b = samples[n];
      if (time > b.time) continue;
      const t = (time - a.time) / (b.time - a.time),
        p = { ...b.player };
      for (const key of [
        "x",
        "y",
        "z",
        "velocityX",
        "velocityZ",
        "verticalVelocity",
      ] as const)
        p[key] = a.player[key] + (b.player[key] - a.player[key]) * t;
      p.moving = Math.hypot(p.velocityX, p.velocityZ) > 0.01;
      p.angle = a.player.angle + angleDelta(a.player.angle, b.player.angle) * t;
      return p;
    }
    const last = samples.at(-1)!,
      p = { ...last.player };
    const dt = Math.min(NETWORK.extrapolationMs, time - last.time) / 1000;
    // Predict only briefly, with the same collision/landing rules; then freeze.
    if (dt > 0)
      move(
        p,
        {
          seq: p.seq,
          x: p.velocityX / speed(p),
          z: p.velocityZ / speed(p),
          jump: false,
        },
        dt,
      );
    return p;
  }
}
