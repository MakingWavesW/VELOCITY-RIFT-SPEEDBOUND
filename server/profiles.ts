import type { RewardKind, RewardTransaction } from "./rewardVerifier.js";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Player } from "../shared/game.js";
import { DEFAULT_TRAIL } from "../shared/trails.js";
export type Progress = Pick<
  Player,
  | "engagement"
  | "xpBoostUntil"
  | "steps"
  | "gems"
  | "level"
  | "xp"
  | "pets"
  | "equippedPetId"
  | "rebirths"
  | "boostUntil"
  | "equippedTrailId"
> & { owned: string[] };
export class Profiles {
  private db: DatabaseSync;
  private active = new Set<string>();
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS engagement_grants (profile TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY(profile,key)); CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reward_transactions (id TEXT PRIMARY KEY, profile TEXT NOT NULL, kind TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, claimed INTEGER); CREATE INDEX IF NOT EXISTS reward_profile ON reward_transactions(profile); CREATE TABLE IF NOT EXISTS crystal_transactions (profile TEXT NOT NULL, id TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(profile,id))",
    );
  }
  commitGrant(profile: string, key: string, data: Progress) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = this.db
        .prepare("INSERT OR IGNORE INTO engagement_grants VALUES (?,?)")
        .run(profile, key);
      if (Number(r.changes) !== 1) {
        this.db.exec("ROLLBACK");
        return false;
      }
      this.save(profile, data);
      this.db.exec("COMMIT");
      return true;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  reserveReward(profile: string, kind: RewardKind, now: number) {
    // One active request at a time; five minutes between successfully granted rewards.
    const recent = this.db
      .prepare(
        "SELECT id FROM reward_transactions WHERE profile=? AND ((claimed IS NULL AND expires>?) OR claimed>?) LIMIT 1",
      )
      .get(profile, now, now - 300_000);
    if (recent) return undefined;
    const tx: RewardTransaction = {
      id: randomUUID(),
      profile,
      kind,
      created: now,
      expires: now + 300_000,
      claimed: null,
    };
    this.db
      .prepare("INSERT INTO reward_transactions VALUES (?,?,?,?,?,NULL)")
      .run(tx.id, profile, kind, now, tx.expires);
    return tx;
  }
  rewardTransaction(id: string) {
    return this.db
      .prepare("SELECT * FROM reward_transactions WHERE id=?")
      .get(id) as RewardTransaction | undefined;
  }
  commitReward(id: string, profile: string, data: Progress, now: number) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db
        .prepare(
          "UPDATE reward_transactions SET claimed=? WHERE id=? AND profile=? AND claimed IS NULL AND expires>?",
        )
        .run(now, id, profile, now);
      if (Number(result.changes) !== 1) {
        this.db.exec("ROLLBACK");
        return false;
      }
      this.save(profile, data);
      this.db.exec("COMMIT");
      return true;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  crystalResult(profile: string, id: string) {
    const row = this.db
      .prepare(
        "SELECT result FROM crystal_transactions WHERE profile=? AND id=?",
      )
      .get(profile, id);
    return row
      ? (JSON.parse(String(row.result)) as { pet: string; crystal: string })
      : undefined;
  }
  commitCrystal(
    profile: string,
    id: string,
    data: Progress,
    result: { pet: string; crystal: string },
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.crystalResult(profile, id)) {
        this.db.exec("ROLLBACK");
        return false;
      }
      this.db
        .prepare("INSERT INTO crystal_transactions VALUES(?,?,?)")
        .run(profile, id, JSON.stringify(result));
      this.save(profile, data);
      this.db.exec("COMMIT");
      return true;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  acquire(token?: unknown) {
    const valid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
    let secret = valid ? (token as string) : randomBytes(32).toString("hex");
    const hash = (s: string) => createHash("sha256").update(s).digest("hex");
    let id = hash(secret);
    const row = valid
      ? this.db.prepare("SELECT data FROM profiles WHERE id = ?").get(id)
      : undefined;
    if (valid && !row) {
      secret = randomBytes(32).toString("hex");
      id = hash(secret);
    }
    if (this.active.has(id))
      throw new Error(
        "This runner is already connected. Close the other game tab first.",
      );
    const data: Progress = row
      ? JSON.parse(String(row.data))
      : {
          steps: 0,
          gems: 0,
          level: 1,
          xp: 0,
          rebirths: 0,
          boostUntil: 0,
          equippedTrailId: DEFAULT_TRAIL,
          owned: [DEFAULT_TRAIL],
        };
    data.pets ||= {};
    this.active.add(id);
    this.save(id, data);
    return { id, token: secret, data };
  }
  save(id: string, data: Progress) {
    this.db
      .prepare(
        "INSERT INTO profiles VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(id, JSON.stringify(data));
  }
  release(id: string) {
    this.active.delete(id);
  }
  close() {
    this.db.close();
  }
}
export function progress(p: Player, owned: Set<string>): Progress {
  return {
    engagement: p.engagement,
    xpBoostUntil: p.xpBoostUntil || 0,
    steps: p.steps,
    gems: p.gems,
    level: p.level,
    xp: p.xp,
    rebirths: p.rebirths || 0,
    pets: p.pets || {},
    equippedPetId: p.equippedPetId,
    boostUntil: p.boostUntil || 0,
    equippedTrailId: p.equippedTrailId,
    owned: [...owned],
  };
}
