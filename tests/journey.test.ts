import assert from "node:assert/strict";
import { test } from "node:test";
import { newJourney, journeyMilestones } from "../shared/journey.js";
test("all seven session challenges start unearned", () => {
 const tasks = journeyMilestones(newJourney());
 assert.equal(tasks.length, 7);
 assert.equal(tasks.filter(t => t.completed).length, 0);
 assert.ok(tasks.every(t => t.current === 0));
});
test("confirmed counters complete milestones independently", () => {
 const tasks = journeyMilestones({
  ...newJourney(), pickups: 31, earnedSteps: 300, rings: 2,
  blue: 2, purple: 1, red: 1, gold: 1, trailEquipped: true
 });
 assert.equal(tasks.filter(t => t.completed).length, 7);
 assert.ok(tasks.every(t => t.current === t.goal));
});
test("three different orb colors are required for Spectrum Chaser", () => {
 const a = journeyMilestones({...newJourney(), blue: 12, purple: 7 });
 assert.equal(a.find(t => t.id === "spectrum")?.current, 2);
 assert.equal(a.find(t => t.id === "spectrum")?.completed, false);
 const b = journeyMilestones({...newJourney(), blue: 1, purple: 1, red: 1 });
 assert.equal(b.find(t => t.id === "spectrum")?.completed, true);
});
test("new session state never inherits old progress", () => {
 const a = newJourney();
 a.pickups = 100;
 a.trailEquipped = true;
 const b = newJourney();
 assert.equal(b.pickups, 0);
 assert.equal(b.trailEquipped, false);
});
