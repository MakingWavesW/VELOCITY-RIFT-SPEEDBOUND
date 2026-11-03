import type { Player } from "../shared/game.js";
import { verifiedReward } from "../shared/progression.js";
import { Profiles, progress } from "./profiles.js";
import type { RewardKind, RewardVerifier } from "./rewardVerifier.js";
export class Rewards {
  constructor(
    private store: Profiles,
    private verifier: RewardVerifier,
  ) {}
  get available() {
    return this.verifier.available;
  }
  prepare(profile: string, kind: RewardKind, p: Player, now = Date.now()) {
    if (
      !this.available ||
      !["level", "speed", "xp"].includes(kind) ||
      (kind === "xp" && (p.xpBoostUntil || 0) > now) ||
      (kind === "speed" && (p.boostUntil || 0) > now)
    )
      return undefined;
    return this.store.reserveReward(profile, kind, now);
  }
  async settle(
    profile: string,
    id: string,
    getCurrent: () => { player: Player; owned: Set<string> } | undefined,
    now = () => Date.now(),
  ) {
    if (!this.available) return false;
    const tx = this.store.rewardTransaction(id);
    if (
      !tx ||
      tx.profile !== profile ||
      tx.claimed !== null ||
      tx.expires <= now()
    )
      return false;
    // No completion boolean, amount or proof supplied by a game client enters this call.
    if ((await this.verifier.verify(Object.freeze({ ...tx }))) !== "verified")
      return false;
    const current = getCurrent();
    if (!current || tx.expires <= now()) return false;
    const updated = { ...current.player };
    if (!verifiedReward(updated, tx.kind, now())) return false;
    if (
      !this.store.commitReward(
        id,
        profile,
        progress(updated, current.owned),
        now(),
      )
    )
      return false;
    Object.assign(current.player, updated);
    return true;
  }
}
