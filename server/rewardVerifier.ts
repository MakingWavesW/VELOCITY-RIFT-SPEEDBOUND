/** Implement this against an approved provider server API/webhook, never a browser callback. */
export type RewardKind = "level" | "speed" | "xp";
export type RewardTransaction = {
  id: string;
  profile: string;
  kind: RewardKind;
  created: number;
  expires: number;
  claimed: number | null;
};
export interface RewardVerifier {
  readonly available: boolean;
  verify(
    transaction: Readonly<RewardTransaction>,
  ): Promise<"verified" | "pending" | "rejected">;
}
/** No environment flag can turn client assertions into verification. Replace with an approved adapter. */
export const rewardVerifier: RewardVerifier = {
  available: false,
  async verify() {
    return "rejected";
  },
};
