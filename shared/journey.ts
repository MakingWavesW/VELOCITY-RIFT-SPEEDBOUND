/** Cosmetic session challenges. These never grant XP, Steps, Gems or server authority. */
export type JourneyFacts = {
  pickups: number;
  earnedSteps: number;
  rings: number;
  blue: number;
  purple: number;
  red: number;
  gold: number;
  trailEquipped: boolean;
};
export type JourneyMilestone = {
  id: string;
  title: string;
  description: string;
  current: number;
  goal: number;
  completed: boolean;
};
export function newJourney(): JourneyFacts {
  return { pickups: 0, earnedSteps: 0, rings: 0, blue: 0, purple: 0,
    red: 0, gold: 0, trailEquipped: false };
}
export function journeyMilestones(facts: JourneyFacts): JourneyMilestone[] {
  const tasks: Array<[string, string, string, number, number]> = [
    ["first-sparks", "First Sparks", "Collect 5 energy orbs", facts.pickups, 5],
    ["momentum", "Find Your Momentum", "Earn 250 Steps", facts.earnedSteps, 250],
    ["skybound", "Skybound", "Clear a glowing XP ring", facts.rings, 1],
    ["spectrum", "Spectrum Chaser", "Collect Blue, Purple & Red orbs",
      Number(facts.blue > 0) + Number(facts.purple > 0) + Number(facts.red > 0), 3],
    ["gold", "Golden Hour", "Find a Gold Gem orb", facts.gold, 1],
    ["trailblazer", "Trailblazer", "Equip a non-default trail",
      Number(facts.trailEquipped), 1],
    ["rift-runner", "Rift Runner", "Collect 30 energy orbs", facts.pickups, 30],
  ];
  return tasks.map(([id, title, description, current, goal]) => ({
    id, title, description, current: Math.max(0, Math.min(current, goal)),
    goal, completed: current >= goal,
  }));
}
