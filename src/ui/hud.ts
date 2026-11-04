import { audio } from "../media/audio";
import {
  rebirthRequirement,
  rebirthMultiplier,
} from "../../shared/progression";
import { createTrailsPanel } from "./trails";
import {
  DEFAULT_TRAIL,
  TRAIL_BY_ID,
  TRAILS,
  type TrailInventory,
} from "../../shared/trails";
import { pickupReward } from "../../shared/pickupReward";
import { ORB_TYPES, ORB_BALANCE, type PickupEvent } from "../../shared/orbs";
import { orbRoutes } from "../../shared/orbRoutes";
import { districts, districtAt, solids } from "../../shared/world";
import { speed, type Player } from "../../shared/game";
import "@fontsource/lilita-one/latin-400.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-900.css";
export const $ = (id: string) => document.getElementById(id)!;
const icons = { steps: "ϟ", gems: "◆", speed: "➤", level: "★" };
export function createHud() {
  document.querySelector("#app")!.innerHTML =
    `<div id="hud"><div class="brand">VELOCITY<span>RIFT</span><small>SPEEDBOUND / VYRNORA STUDIOS</small></div><div id="stats">${Object.entries(
      icons,
    )
      .map(
        ([id, icon]) =>
          `<div class="stat ${id}"><i>${icon}</i><div><small>${id === "level" ? "LEVEL" : id.toUpperCase()}</small><b id="${id === "level" ? "levelNumber" : id}">${id === "level" ? 1 : 0}</b></div></div>`,
      )
      .join(
        "",
      )}</div><div id="connection">● CONNECTING</div><div id="location"><small>EXPLORE THE ISLAND</small><strong id="district">Sunburst Plaza</strong><span>Follow the glow. Find your speed.</span></div><nav class="menu"><button data-panel="rebirth" class="official rebirth"><img src="/media/rebirth.png" alt=""><span>REBIRTH</span></button><button data-panel="trails" class="official trails"><img src="/media/trails.png" alt=""><span>TRAILS</span></button><button data-panel="map"><i>⌖</i><span>Island map</span><kbd>M</kbd></button><button data-panel="settings" class="gear"><img src="/media/settings.png" alt=""><span>Settings</span></button><button data-panel="help"><i>?</i><span>How to play</span></button><button id="hello"><i>♡</i><span>Say hello</span></button></nav><div id="roster" class="card"><small>IN THIS WORLD</small><div id="players">Waiting for connection</div></div><div id="toast" role="status"></div><div id="orbLegend" aria-label="Current orb rewards"></div><div id="pickupFeed" role="status" aria-live="polite"></div><div id="streak"></div><div class="levelbar"><div><span id="level">LEVEL 1</span><span id="xpText">0 / 40 XP</span></div><progress id="xp" max="40" value="0"></progress><small id="collectionGoal">COLLECT 9 GEMS · FIND YOUR FIRST COMPANION</small></div><div id="help">WASD <span>move</span> &nbsp; SPACE <span>jump</span> &nbsp; DRAG <span>look</span></div><div id="session">WORLD 1 · MAIN CITY · SAVED RUNNER</div></div><div id="entry"><div class="entry-art"><small>VYRNORA STUDIOS PRESENTS</small><h1>VELOCITY<br><em>RIFT</em><small>SPEEDBOUND</small></h1><p>A sun-soaked island. A thousand little discoveries.<br>Your next adventure starts with a single step.</p><span class="tag">REAL PLAYERS. ONE SHARED WORLD.</span></div><div class="entry-card"><span class="eyebrow">WELCOME TO SPEEDBOUND</span><h2>Find your fast.</h2><p>Meet in Sunburst Plaza, chase energy orbs, and turn every step into something extraordinary.</p><label for="name">YOUR RUNNER NAME</label><input id="name" maxlength="18" placeholder="Enter a name" autocomplete="nickname"><button id="join">PLAY <span>→</span></button><p id="error">Guest runner · Progress saved on this device</p><button data-panel="settings" class="menu-settings">Music, sound & settings</button><div class="entry-foot"><span>ϟ Run & level up</span><span>◆ Collect together</span></div></div></div><dialog id="panel"><div class="panel-head"><h2 id="panelTitle"></h2><button id="closePanel" aria-label="Close panel">×</button></div><div id="panelBody"></div></dialog><div id="touch"><div id="stick"><span></span></div></div><button id="jump" aria-label="Jump">↑<small>JUMP</small></button>`;
  $("hello").setAttribute("aria-label", "Say hello");
  const panel = $("panel") as HTMLDialogElement;
  let active = "";
  let map: HTMLCanvasElement | undefined;
  const volume = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(1, v))
      : fallback;
  let settings = {
    night: false,
    dayCycle: true,
    quality: "high",
    sensitivity: 1,
    comfort: false,
    remoteTrails: true,
    shadows: true,
    trailEffects: true,
    master: 0.65,
    music: 0.35,
    sfx: 0.65,
    muted: false,
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("rift-visual-settings") || "{}",
    );
    settings = {
      night: saved.night === true,
      dayCycle: saved.dayCycle !== false,
      quality:
        saved.quality === "low" || saved.quality === "medium"
          ? saved.quality
          : "high",
      sensitivity: Math.max(0.3, Math.min(2, Number(saved.sensitivity) || 1)),
      comfort: saved.comfort === true,
      remoteTrails: saved.remoteTrails !== false,
      shadows: saved.shadows !== false,
      trailEffects: saved.trailEffects !== false,
      master: volume(saved.master, 0.65),
      music: volume(saved.music, 0.35),
      sfx: volume(saved.sfx, 0.65),
      muted: saved.muted === true,
    };
  } catch {}
  let onSettings = () => {};
  let onRebirth = (_expected: number) => {};
  let onReward = (_kind: string) => {};
  let onEquip = (_id: string) => {};
  let trailPanel: ReturnType<typeof createTrailsPanel> | undefined;
  let inventory: TrailInventory = {
    owned: [],
    equipped: DEFAULT_TRAIL,
    level: 1,
    sessionOnly: true,
  };
  panel.addEventListener("close", () => {
    trailPanel?.dispose();
    trailPanel = undefined;
    panel.classList.remove("trails-panel");
  });
  function save() {
    try {
      localStorage.setItem("rift-visual-settings", JSON.stringify(settings));
    } catch {}
    audio.configure(settings);
    onSettings();
  }
  function open(name: string) {
    trailPanel?.dispose();
    trailPanel = undefined;
    panel.classList.toggle("trails-panel", name === "trails");
    active = name;
    map = undefined;
    $("panelTitle").textContent =
      {
        rebirth: "A golden new beginning",
        trails: "Leave a little light",
        map: "Your island awaits",
        settings: "Make it yours",
        help: "A little momentum goes a long way",
      }[name] || "";
    if (name === "rebirth") {
      const p = player,
        count = p?.rebirths || 0,
        required = rebirthRequirement(count);
      $("panelBody").innerHTML =
        `<div class="rebirth-panel"><img src="/media/rebirth.png" alt="Rebirth"><h3>Go further on your next run</h3><dl><dt>Current level</dt><dd>${p?.level || 1}</dd><dt>Rebirths</dt><dd>${count}</dd><dt>Required level</dt><dd>${required}</dd><dt>XP multiplier</dt><dd>${rebirthMultiplier(count)}× → ${rebirthMultiplier(count + 1)}×</dd></dl><p>Reset Level, XP and Steps. Keep every unlocked trail and all Gems. Gain a permanent +25% base XP multiplier.</p><button id="confirmRebirth" ${(p?.level || 0) < required ? "disabled" : ""}>Confirm rebirth</button><button id="cancelRebirth">Cancel</button></div>`;
      $("confirmRebirth").onclick = () => {
        ($("confirmRebirth") as HTMLButtonElement).disabled = true;
        onRebirth(count);
      };
      $("cancelRebirth").onclick = () => panel.close();
    }
    if (name === "trails") {
      trailPanel = createTrailsPanel($("panelBody"), (id) => onEquip(id));
      trailPanel.inventory(inventory);
    }
    if (name === "map") {
      $("panelBody").innerHTML =
        `<canvas id="mapCanvas" width="600" height="600" aria-label="Island map with your live position"></canvas><div class="district-list">${districts.map((d, i) => `<div><b>${i + 1}. ${d.name}</b><small>${d.description}</small></div>`).join("")}</div>`;
      map = $("mapCanvas") as HTMLCanvasElement;
    }
    if (name === "settings") {
      $("panelBody").innerHTML =
        `<label class="setting">Automatic day/night cycle <input id="dayCycle" type="checkbox" ${settings.dayCycle ? "checked" : ""}></label><label class="setting">Night atmosphere <input id="night" type="checkbox" ${settings.night ? "checked" : ""}></label><p class="hint">A personal visual setting. Multiplayer time and rewards are unchanged.</p><label class="setting">Graphics <select id="quality"><option value="high">High · soft shadows</option><option value="medium">Medium · balanced detail</option><option value="low">Low · lighter rendering</option></select></label><label class="setting">Camera sensitivity <input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="${settings.sensitivity}"></label><label class="setting">Reduce motion & particles <input id="comfort" type="checkbox" ${settings.comfort ? "checked" : ""}></label><label class="setting">Show other players’ trails <input id="remoteTrails" type="checkbox" ${settings.remoteTrails ? "checked" : ""}></label>`;
      $("panelBody").insertAdjacentHTML(
        "beforeend",
        `<label class="setting">Shadows<input id="shadows" type="checkbox" ${settings.shadows ? "checked" : ""}></label><label class="setting">Trail effects<input id="trailEffects" type="checkbox" ${settings.trailEffects ? "checked" : ""}></label>${(["master", "music", "sfx"] as const).map((key) => `<label class="setting">${key === "sfx" ? "SFX" : key[0].toUpperCase() + key.slice(1)} volume<input id="${key}" type="range" min="0" max="1" step=".05" value="${settings[key]}"></label>`).join("")}<label class="setting">Mute all<input id="muted" type="checkbox" ${settings.muted ? "checked" : ""}></label>`,
      );
      for (const key of ["master", "music", "sfx"] as const)
        $(key).oninput = () => {
          settings[key] = Number(($(key) as HTMLInputElement).value);
          save();
        };
      for (const key of ["shadows", "trailEffects", "muted"] as const)
        $(key).onchange = () => {
          settings[key] = ($(key) as HTMLInputElement).checked;
          save();
        };
      ($("quality") as HTMLSelectElement).value = settings.quality;
      for (const id of [
        "night",
        "dayCycle",
        "quality",
        "sensitivity",
        "comfort",
        "remoteTrails",
      ])
        $(id).onchange = () => {
          settings.dayCycle = ($("dayCycle") as HTMLInputElement).checked;
          if (id === "night") {
            settings.dayCycle = false;
            ($("dayCycle") as HTMLInputElement).checked = false;
          }
          settings.night = ($("night") as HTMLInputElement).checked;
          settings.quality = ($("quality") as HTMLSelectElement).value;
          settings.sensitivity = Number(
            ($("sensitivity") as HTMLInputElement).value,
          );
          settings.comfort = ($("comfort") as HTMLInputElement).checked;
          settings.remoteTrails = (
            $("remoteTrails") as HTMLInputElement
          ).checked;
          save();
        };
    }
    if (name === "help")
      $("panelBody").innerHTML =
        `<div class="help-grid"><article><i>ϟ</i><h3>Keep moving</h3><p>WASD or arrow keys to run. Space to jump. On touchscreens, use the joystick and jump button.</p></article><article><i>◆</i><h3>Chase the glow</h3><p>Blue → Purple → Red: higher tiers give more Steps and XP. At level 1: 2 / 5 / 10. At level 10: 10 / 25 / 50. Gold retains Gems. 96 shared orbs scatter across Main City and replenish at new valid locations in 1–3 seconds. Collect gold orbs for Gems and visit a crystal for a companion.</p></article><article><i>◎</i><h3>Catch some air</h3><p>Glowing blue launch pads lift you toward rings. Pass through a ring for 20 XP; each has a 20-second personal cooldown.</p></article><article><i>⌖</i><h3>Explore together</h3><p>Drag to turn the camera, scroll to zoom. Use M for the island map, Escape to close menus. Say hello to real players.</p></article></div><div class="orb-routes">${orbRoutes.map((r) => `<p><b>${r.name}</b> · ${r.hint}</p>`).join("")}</div><p class="hint">Combo Rush grants 1 Gem after five quick pickups, with a 30-second cooldown and 20-Gem daily cap. Trails unlock free at level milestones. Gem bonuses apply only to Gem-paying pickups; Steps bonuses apply only to orb pickups. Level, Gems, Steps, rebirths and unlocked trails are saved for this device. Clearing browser data loses access to the guest runner. Journey challenges restart when reconnecting. Crystals and pets are available beside spawn and around the city. Competitive races are not yet available.</p>`;
    if (!panel.open) panel.showModal();
  }
  for (const button of document.querySelectorAll<HTMLElement>("[data-panel]")) {
    button.setAttribute("aria-label", button.dataset.panel!);
    button.onclick = () => open(button.dataset.panel!);
  }
  $("closePanel").onclick = () => panel.close();
  panel.onclick = (e) => {
    if (e.target === panel) {
      const r = panel.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        panel.close();
    }
  };
  const offers = document.createElement("div");
  offers.id = "rewardOffers";
  offers.innerHTML = '<span id="boostCountdown"></span>';
  $("hud").append(offers);
  for (const b of offers.querySelectorAll<HTMLButtonElement>("button"))
    b.onclick = () => onReward(b.dataset.reward!);
  const numbers = { steps: 0, gems: 0, speed: 9 };
  let player: Player | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let rosterKey = "";
  let streakTimeout: ReturnType<typeof setTimeout>;
  let rewardKey = "";
  function clearPickups() {
    $("pickupFeed").replaceChildren();
    $("streak").textContent = "";
    clearTimeout(streakTimeout);
  }
  function pickup(event: PickupEvent) {
    const d = ORB_TYPES[event.orb.tier],
      el = document.createElement("div");
    el.className = "orb-pickup";
    el.style.setProperty(
      "--orb-color",
      "#" + d.color.toString(16).padStart(6, "0"),
    );
    el.dataset.tier = event.orb.tier;
    const name = document.createElement("small");
    name.textContent = d.label;
    const amount = document.createElement("strong");
    amount.textContent = `+${event.steps} Steps  +${event.xp} XP${event.gems ? "  +" + event.gems + " Gems" : ""}`;
    el.append(name, amount);
    while ($("pickupFeed").childElementCount >= 4)
      $("pickupFeed").firstElementChild?.remove();
    $("pickupFeed").append(el);
    setTimeout(() => el.remove(), 2000);
    $("streak").textContent =
      event.streak > 1
        ? `${event.streak} ORB RUSH · ${"●".repeat(Math.min(5, event.streak))}${"○".repeat(Math.max(0, 5 - event.streak))}`
        : "";
    clearTimeout(streakTimeout);
    streakTimeout = setTimeout(
      () => ($("streak").textContent = ""),
      ORB_BALANCE.streakWindowMs,
    );
    // Future sound adapters subscribe to confirmed pickups; no audio engine is required.
    window.dispatchEvent(new CustomEvent("rift:orb-pickup", { detail: event }));
  }
  function toast(text: string) {
    $("toast").textContent = text;
    $("toast").classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => $("toast").classList.remove("show"), 2400);
  }
  const format = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return {
    onRewardRequest(kind: string) {
      onReward(kind);
    },
    set onRebirth(fn: (expected: number) => void) {
      onRebirth = fn;
    },
    set onReward(fn: (kind: string) => void) {
      onReward = fn;
    },
    pickup,
    clearPickups,
    inventory(value: TrailInventory) {
      inventory = value;
      trailPanel?.inventory(value);
      if (value.message) toast(value.message);
    },
    set onEquip(fn: (id: string) => void) {
      onEquip = fn;
    },
    settings,
    panel,
    open,
    toast,
    set onSettings(fn: () => void) {
      onSettings = fn;
    },
    snapshot(p: Player, players: Record<string, Player>) {
      player = p;
      const nextRewardKey = [
        p.level,
        p.rebirths,
        p.equippedTrailId,
        p.equippedPetId,
      ].join(":");
      if (rewardKey !== nextRewardKey) {
        rewardKey = nextRewardKey;
        $("orbLegend").replaceChildren(
          ...(["blue", "purple", "red"] as const).map((tier) => {
            const e = document.createElement("span");
            e.style.setProperty(
              "--orb-color",
              "#" + ORB_TYPES[tier].color.toString(16).padStart(6, "0"),
            );
            e.textContent = `● ${tier.toUpperCase()} +${pickupReward(p, tier, TRAIL_BY_ID.get(p.equippedTrailId || DEFAULT_TRAIL) || TRAILS[0]).steps}`;
            return e;
          }),
        );
      }
      $("level").textContent = `LEVEL ${p.level} · ${p.rebirths || 0} REBIRTHS`;
      $("levelNumber").textContent = String(p.level);
      const species = Object.keys(p.pets || {}).length;
      $("collectionGoal").textContent = species
        ? `${species} / 12 COMPANIONS · COLLECT GEMS FOR YOUR NEXT CRYSTAL`
        : `${Math.min(9, p.gems)} / 9 GEMS · SUNRISE CRYSTAL BESIDE SPAWN`;
      $("xpText").textContent = `${p.xp} / ${p.level * 40} XP`;
      const xp = $("xp") as HTMLProgressElement;
      xp.max = p.level * 40;
      xp.value = p.xp;
      const key = JSON.stringify(
        Object.values(players).map((p) => [p.id, p.name, p.level]),
      );
      if (key !== rosterKey) {
        rosterKey = key;
        $("players").replaceChildren(
          ...Object.values(players)
            .sort((a, b) => b.level - a.level)
            .map((p) => {
              const d = document.createElement("div");
              const n = document.createElement("span");
              n.textContent = p.name;
              const l = document.createElement("b");
              l.textContent = `Lv ${p.level}`;
              d.append(n, l);
              return d;
            }),
        );
      }
    },
    update(dt: number) {
      if (panel.open) trailPanel?.update(dt, settings.comfort);
      if (!player) return;
      for (const key of ["steps", "gems", "speed"] as const) {
        const target = key === "speed" ? speed(player) : player[key];
        numbers[key] += (target - numbers[key]) * Math.min(1, dt * 14);
        $(key).textContent =
          key === "speed"
            ? numbers[key].toFixed(1)
            : format.format(Math.round(numbers[key]));
      }
      $("district").textContent = districtAt(player.x, player.z).name;
      if (panel.open && active === "map" && map) {
        const ctx = map.getContext("2d")!,
          s = 600 / 900;
        ctx.fillStyle = "#59b8cc";
        ctx.fillRect(0, 0, 600, 600);
        ctx.fillStyle = "#8bc899";
        ctx.fillRect(7, 7, 586, 586);
        ctx.strokeStyle = "#3c566c";
        ctx.lineWidth = 11;
        for (const a of [0, 190, -330, 330]) {
          ctx.beginPath();
          ctx.moveTo((a + 450) * s, 7);
          ctx.lineTo((a + 450) * s, 593);
          ctx.stroke();
        }
        for (const a of [0, 170, -330, 330]) {
          ctx.beginPath();
          ctx.moveTo(7, (a + 450) * s);
          ctx.lineTo(593, (a + 450) * s);
          ctx.stroke();
        }
        ctx.fillStyle = "#bdafcf";
        for (const b of solids)
          ctx.fillRect(
            (b.x - b.w / 2 + 450) * s,
            (b.z - b.d / 2 + 450) * s,
            b.w * s,
            b.d * s,
          );
        districts.forEach((d, i) => {
          ctx.fillStyle = "#173c56";
          ctx.beginPath();
          ctx.arc((d.x + 450) * s, (d.z + 450) * s, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(i + 1), (d.x + 450) * s, (d.z + 450) * s + 5);
        });
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc((player.x + 450) * s, (player.z + 450) * s, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ef9857";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    },
  };
}
