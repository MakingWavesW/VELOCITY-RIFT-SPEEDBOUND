import {
  orbRoutes,
  validOrbPoint,
  type OrbRoute,
} from "../shared/orbRoutes.js";
import {
  ORB_BALANCE,
  ORB_TYPES,
  MAX_ORBS,
  type Orb,
  type OrbTier,
  type OrbPatch,
} from "../shared/orbs.js";
export function chooseTier(
  weights: Record<OrbTier, number>,
  random = Math.random,
): OrbTier {
  let choice = random() * Object.values(weights).reduce((a, b) => a + b, 0);
  for (const tier of Object.keys(weights) as OrbTier[]) {
    choice -= weights[tier];
    if (choice < 0) return tier;
  }
  return "blue";
}
type Slot = {
  id: number;
  route: OrbRoute;
  generation: number;
  readyAt: number;
  previous?: Orb;
  orb?: Orb;
};
/** A room owns one manager. There are no client-controlled spawn/reward inputs. */
export class OrbManager {
  revision = 0;
  private slots: Slot[] = [];
  private removed: number[] = [];
  private spawned: Orb[] = [];
  constructor(
    private random: () => number = Math.random,
    now = Date.now(),
  ) {
    for (const route of orbRoutes)
      for (let i = 0; i < route.count; i++)
        this.slots.push({
          id: this.slots.length,
          route,
          generation: 0,
          readyAt: now,
        });
    if (this.slots.length > MAX_ORBS)
      throw new Error("Orb renderer capacity exceeded");
    this.tick(now);
    this.flush();
  }
  get active(): Orb[] {
    return this.slots.flatMap((s) => (s.orb ? [s.orb] : []));
  }
  private spawn(slot: Slot) {
    const start = Math.floor(this.random() * slot.route.points.length);
    for (let attempt = 0; attempt < slot.route.points.length * 2; attempt++) {
      const point =
        slot.route.points[(start + attempt) % slot.route.points.length];
      const p = {
        x: point.x + (this.random() - 0.5) * 1.5,
        y: point.y,
        z: point.z + (this.random() - 0.5) * 1.5,
      };
      if (
        !validOrbPoint(p) ||
        (slot.previous &&
          Math.hypot(p.x - slot.previous.x, p.z - slot.previous.z) < 3)
      )
        continue;
      if (
        this.slots.some(
          (s) =>
            s.orb &&
            Math.hypot(s.orb.x - p.x, s.orb.z - p.z, s.orb.y - (p.y + 1.3)) <
              ORB_BALANCE.minSpacing,
        )
      )
        continue;
      const orb: Orb = {
        id: slot.id,
        generation: ++slot.generation,
        route: slot.route.id,
        tier: chooseTier(slot.route.weights, this.random),
        x: p.x,
        y: p.y + 1.3,
        z: p.z,
      };
      slot.orb = orb;
      this.spawned.push(orb);
      return;
    }
  }
  tick(now: number) {
    for (const s of this.slots)
      if (!s.orb && s.readyAt <= now) {
        this.spawn(s);
        if (!s.orb) s.readyAt = now + 1000;
      }
  }
  /** The server calls this for a physically validated pickup. Consumes atomically. */
  claim(id: number, generation: number, now: number) {
    const s = this.slots[id];
    if (!s?.orb || s.orb.generation !== generation) return undefined;
    const orb = s.orb;
    const [min, max] = ORB_TYPES[orb.tier].respawn;
    s.readyAt = now + min + this.random() * (max - min);
    s.previous = orb;
    s.orb = undefined;
    this.removed.push(id);
    return orb;
  }
  flush(): OrbPatch | undefined {
    if (!this.removed.length && !this.spawned.length) return;
    const patch = {
      revision: ++this.revision,
      removed: this.removed,
      spawned: this.spawned.filter((o) => this.slots[o.id].orb === o),
    };
    this.removed = [];
    this.spawned = [];
    return patch;
  }
  snapshot() {
    return { revision: this.revision, orbs: this.active };
  }
}
/** Swept pickup keeps high-speed runners from skipping an orb between ticks. */
export function touchesOrb(
  orb: Orb,
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  const length = dx * dx + dy * dy + dz * dz;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((orb.x - a.x) * dx + (orb.y - a.y - 1.3) * dy + (orb.z - a.z) * dz) /
            length,
        ),
      )
    : 0;
  return (
    Math.hypot(
      orb.x - a.x - dx * t,
      orb.y - a.y - 1.3 - dy * t,
      orb.z - a.z - dz * t,
    ) <=
    ORB_BALANCE.pickupRadius + ORB_TYPES[orb.tier].radius * 0.35
  );
}
