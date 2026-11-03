export const utcDay = (now: number) => Math.floor(now / 86400000);
export const PLAYTIME = [
  { seconds: 120, gems: 5 },
  { seconds: 300, gems: 12 },
  { seconds: 600, gems: 25 },
  { seconds: 1200, gems: 40 },
  { seconds: 1800, gems: 60 },
];
export const DAILY = [3, 5, 8, 12, 15, 20, 35];
export const INTRO = [
  {
    id: "blue",
    title: "First sparks",
    hint: "Collect 5 Blue orbs",
    goal: 5,
    gems: 2,
  },
  {
    id: "spectrum",
    title: "Find your colors",
    hint: "Collect a Purple and a Red orb",
    goal: 2,
    gems: 2,
  },
  {
    id: "gems",
    title: "Golden route",
    hint: "Collect 6 Gems from orbs",
    goal: 6,
    gems: 2,
  },
  {
    id: "hatch",
    title: "A new friend",
    hint: "Open a crystal",
    goal: 1,
    gems: 3,
  },
  {
    id: "equip",
    title: "Together is faster",
    hint: "Equip a pet",
    goal: 1,
    gems: 2,
  },
  {
    id: "trial",
    title: "City sprint",
    hint: "Finish the Plaza Dash time trial",
    goal: 1,
    gems: 5,
  },
];
export type Engagement = {
  day: number;
  activeMs: number;
  playClaims: number[];
  dailyLast: number;
  dailyIndex: number;
  counts: Record<string, number>;
  dailyCounts: Record<string, number>;
  introClaims: string[];
  questClaims: string[];
  bestMs?: number;
  trialRewardAt?: number;
  comboAt?: number;
  comboRewards: number;
};
export function freshEngagement(now: number): Engagement {
  return {
    day: utcDay(now),
    activeMs: 0,
    playClaims: [],
    dailyLast: -1,
    dailyIndex: 0,
    counts: {},
    dailyCounts: {},
    introClaims: [],
    questClaims: [],
    comboRewards: 0,
  };
}
export function refreshDay(s: Engagement, now: number) {
  const day = utcDay(now);
  if (day > s.day) {
    s.day = day;
    s.activeMs = 0;
    s.playClaims = [];
    s.dailyCounts = {};
    s.questClaims = [];
    s.comboRewards = 0;
  }
  return s;
}
export function dailyQuests(day: number) {
  return [
    {
      id: "orbs",
      title: "City collector",
      hint: "Collect energy orbs",
      goal: 20 + (day % 3) * 5,
      gems: 4,
    },
    {
      id: day % 2 ? "purple" : "hoops",
      title: day % 2 ? "Purple pursuit" : "Ring runner",
      hint: day % 2 ? "Collect Purple orbs" : "Cross XP hoops",
      goal: day % 2 ? 5 : 2,
      gems: 6,
    },
    {
      id: "distance",
      title: "Explore Main City",
      hint: "Run real meters",
      goal: 500 + (day % 3) * 100,
      gems: 8,
    },
  ];
}
export function recordActivity(s: Engagement, key: string, amount = 1) {
  s.counts[key] = Math.min(1e7, (s.counts[key] || 0) + amount);
  s.dailyCounts[key] = Math.min(1e7, (s.dailyCounts[key] || 0) + amount);
}
export function introValue(s: Engagement, id: string) {
  return id === "spectrum"
    ? Number((s.counts.purple || 0) > 0) + Number((s.counts.red || 0) > 0)
    : s.counts[id] || 0;
}
export function claimEngagement(
  s: Engagement,
  kind: string,
  id: string,
  now: number,
): { key: string; gems: number } | undefined {
  refreshDay(s, now);
  if (kind === "playtime") {
    const i = Number(id),
      r = PLAYTIME[i];
    if (
      !Number.isInteger(i) ||
      !r ||
      s.playClaims.includes(i) ||
      s.activeMs < r.seconds * 1000
    )
      return;
    s.playClaims.push(i);
    return { key: `play:${s.day}:${i}`, gems: r.gems };
  }
  if (kind === "daily") {
    if (utcDay(now) < s.day || s.dailyLast >= s.day) return;
    const i = s.dailyLast === s.day - 1 ? (s.dailyIndex + 1) % 7 : 0;
    s.dailyIndex = i;
    s.dailyLast = s.day;
    return { key: `daily:${s.day}`, gems: DAILY[i] };
  }
  if (kind === "intro") {
    const i = INTRO.findIndex((r) => r.id === id),
      r = INTRO[i];
    if (
      !r ||
      s.introClaims.includes(id) ||
      INTRO.slice(0, i).some((r) => !s.introClaims.includes(r.id)) ||
      introValue(s, id) < r.goal
    )
      return;
    s.introClaims.push(id);
    return { key: `intro:${id}`, gems: r.gems };
  }
  if (kind === "quest") {
    const r = dailyQuests(s.day).find((r) => r.id === id);
    if (!r || s.questClaims.includes(id) || (s.dailyCounts[id] || 0) < r.goal)
      return;
    s.questClaims.push(id);
    return { key: `quest:${s.day}:${id}`, gems: r.gems };
  }
}
export const TRIAL = {
  name: "Plaza Dash · Solo time trial",
  points: [
    { x: 0, z: -50 },
    { x: 0, z: -100 },
    { x: 0, z: -50 },
    { x: 0, z: 0 },
  ],
  reward: 8,
  cooldown: 300000,
};
