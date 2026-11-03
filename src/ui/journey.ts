import type { Orb } from "../../shared/orbs";
import type { Player } from "../../shared/game";
import type { PickupEvent } from "../../shared/orbs";
import { ORB_TYPES } from "../../shared/orbs";
import { DEFAULT_TRAIL, type TrailInventory } from "../../shared/trails";
import { newJourney, journeyMilestones } from "../../shared/journey";

/** Optional read-only exploration UI; does not affect multiplayer rewards. */
export function createJourneyUI() {
  const parent = document.createElement("aside");
  parent.id = "journeyOverlay";
  parent.innerHTML =
    '<section id="journey" aria-label="Runner journey"><div class="journey-head"><span>✦ RUNNER JOURNEY</span><strong id="journeyCount">0 / 7</strong></div><div class="journey-body"><b id="journeyTitle">First Sparks</b><small id="journeyDescription">Collect 5 energy orbs</small><div class="journey-track"><span id="journeyFill"></span></div><small id="journeyProgress">0 / 5</small></div><button id="journeyNext" title="Next objective" aria-label="Next objective">›</button></section><section id="orbCompass" aria-label="Nearest orb guide"><span>⌖</span><div><b id="compassName">LOOK FOR ENERGY</b><small id="compassDistance">Exploring...</small></div><span id="compassArrow">↑</span></section>';
  document.body.append(parent);
  const el = (id: string) => parent.querySelector<HTMLElement>("#" + id)!;
  let previousSteps: number | undefined;
  let previousComplete = 0;
  let onComplete = () => {};
  let facts = newJourney(),
    page = 0,
    key = "",
    lastNav = 0,
    active = false;
  function render() {
    const tasks = journeyMilestones(facts);
    const complete = tasks.filter((t) => t.completed).length;
    if (complete > previousComplete && active) onComplete();
    previousComplete = complete;
    const remaining = tasks.filter((t) => !t.completed);
    const task = remaining.length
      ? remaining[page % remaining.length]
      : tasks[tasks.length - 1];
    const next = [complete, task.id, task.current].join(":");
    if (key === next) return;
    key = next;
    el("journeyCount").textContent = complete + " / " + tasks.length;
    el("journeyTitle").textContent =
      complete === tasks.length ? "JOURNEY COMPLETE" : task.title;
    el("journeyDescription").textContent =
      complete === tasks.length
        ? "All seven session challenges finished!"
        : task.description;
    el("journeyProgress").textContent =
      task.current + " / " + task.goal + " · no bonus rewards";
    el("journeyFill").style.width = (100 * task.current) / task.goal + "%";
  }
  el("journeyNext").onclick = () => {
    page++;
    key = "";
    render();
  };
  render();
  return {
    set onComplete(fn: () => void) {
      onComplete = fn;
    },
    show() {
      active = true;
      parent.style.display = "block";
    },
    hide() {
      active = false;
      parent.style.display = "none";
    },
    reset() {
      previousSteps = undefined;
      previousComplete = 0;
      facts = newJourney();
      page = 0;
      key = "";
      render();
      this.hide();
    },
    snapshot(p: Player) {
      // Server-confirmed Steps include both movement and pickups.
      if (previousSteps !== undefined)
        facts.earnedSteps += Math.max(
          0,
          Math.floor(p.steps) - Math.floor(previousSteps),
        );
      previousSteps = p.steps;
      render();
    },
    pickup(event: PickupEvent) {
      facts.pickups++;
      if (event.orb.tier === "gem") facts.gold++;
      else facts[event.orb.tier]++;
      render();
    },
    ring() {
      facts.rings++;
      render();
    },
    inventory(value: TrailInventory) {
      facts.trailEquipped ||= value.equipped !== DEFAULT_TRAIL;
      render();
    },
    navigate(p: Player | undefined, orbs: Orb[], yaw: number) {
      if (!active || !p || performance.now() - lastNav < 200) return;
      lastNav = performance.now();
      let closest: Orb | undefined,
        distance = Infinity;
      for (const o of orbs) {
        const d = Math.hypot(o.x - p.x, o.z - p.z);
        if (d < distance) {
          distance = d;
          closest = o;
        }
      }
      if (!closest) {
        el("compassName").textContent = "SEARCHING FOR ORBS";
        el("compassDistance").textContent = "Waiting for world sync...";
        el("compassArrow").textContent = "⌖";
        return;
      }
      const kind = ORB_TYPES[closest.tier];
      el("compassName").textContent = kind.label;
      el("compassName").style.color =
        "#" + kind.color.toString(16).padStart(6, "0");
      el("compassDistance").textContent =
        Math.round(distance) + "m · nearest energy";
      const angle = Math.atan2(closest.x - p.x, -(closest.z - p.z));
      el("compassArrow").textContent = "↑";
      el("compassArrow").style.transform =
        "rotate(" + ((angle - yaw) * 180) / Math.PI + "deg)";
    },
  };
}
