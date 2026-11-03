import {
  claimEngagement,
  freshEngagement,
  refreshDay,
  recordActivity,
  TRIAL,
  type Engagement,
} from "../shared/engagement.js";
import { progress, type Profiles } from "./profiles.js";
import type { Player } from "../shared/game.js";
export class EngagementService {
  private presence = new Map<string, { active: boolean; until: number }>();
  private trials = new Map<string, { start: number; checkpoint: number }>();
  constructor(private db: Profiles) {}
  state(p: Player, now = Date.now()): Engagement {
    return refreshDay((p.engagement ||= freshEngagement(now)), now);
  }
  visible(p: Player, now = Date.now()) {
    return {
      state: this.state(p, now),
      time: now,
      trial: this.trials.get(p.id),
    };
  }
  heartbeat(id: string, active: boolean, now = Date.now()) {
    this.presence.set(id, { active, until: now + 4000 });
  }
  acceptsMovement(id: string) {
    return this.presence.get(id)?.active !== false;
  }
  claim(
    p: Player,
    profile: string,
    owned: Set<string>,
    kind: string,
    id: string,
    now = Date.now(),
  ) {
    const next = { ...p, engagement: structuredClone(this.state(p, now)) };
    const grant = claimEngagement(next.engagement, kind, id, now);
    if (!grant) return false;
    next.gems += grant.gems;
    if (!this.db.commitGrant(profile, grant.key, progress(next, owned)))
      return false;
    Object.assign(p, next);
    return true;
  }
  start(p: Player, now = Date.now()) {
    if (Math.hypot(p.x, p.z) > 10 || p.y > 2 || this.trials.has(p.id))
      return false;
    this.trials.set(p.id, { start: now + 3000, checkpoint: 0 });
    return true;
  }
  tick(p: Player, distance: number, hasInput: boolean, now: number) {
    const s = this.state(p, now),
      presence = this.presence.get(p.id);
    if (
      hasInput &&
      distance > 0.03 &&
      presence?.active &&
      presence.until >= now
    ) {
      s.activeMs = Math.min(1800000, s.activeMs + 40);
      recordActivity(s, "distance", distance);
    }
    const trial = this.trials.get(p.id);
    if (!trial) return;
    if (now - trial.start > 180000) {
      this.trials.delete(p.id);
      return;
    }
    if (now < trial.start) {
      if (Math.hypot(p.x, p.z) > 10) this.trials.delete(p.id);
      return;
    }
    const target = TRIAL.points[trial.checkpoint];
    if (Math.hypot(p.x - target.x, p.z - target.z) < 7 && p.y < 20) {
      trial.checkpoint++;
      if (trial.checkpoint === TRIAL.points.length) {
        this.trials.delete(p.id);
        const elapsed = now - trial.start;
        if (elapsed < 10000) return;
        s.bestMs = Math.min(s.bestMs || Infinity, elapsed);
        recordActivity(s, "trial");
        return elapsed;
      }
    }
  }
  record(p: Player, key: string, amount = 1) {
    recordActivity(this.state(p), key, amount);
  }
  cleanup(id: string) {
    this.presence.delete(id);
    this.trials.delete(id);
  }
}
