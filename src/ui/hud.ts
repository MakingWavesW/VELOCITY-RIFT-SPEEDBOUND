import {
  ORB_TYPES,
  ORB_BALANCE,
  orbReward,
  type PickupEvent,
} from "../../shared/orbs";
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
      )}</div><div id="connection">● CONNECTING</div><div id="location"><small>EXPLORE THE ISLAND</small><strong id="district">Sunburst Plaza</strong><span>Follow the glow. Find your speed.</span></div><nav class="menu"><button data-panel="map"><i>⌖</i><span>Island map</span><kbd>M</kbd></button><button data-panel="settings"><i>⚙</i><span>Settings</span></button><button data-panel="help"><i>?</i><span>How to play</span></button><button id="hello"><i>♡</i><span>Say hello</span></button></nav><div id="roster" class="card"><small>IN THIS WORLD</small><div id="players">Waiting for connection</div></div><div id="toast" role="status"></div><div id="orbLegend" aria-label="Current orb rewards"></div><div id="pickupFeed" role="status" aria-live="polite"></div><div id="streak"></div><div class="levelbar"><div><span id="level">LEVEL 1</span><span id="xpText">0 / 40 XP</span></div><progress id="xp" max="40" value="0"></progress><small>RUN. COLLECT. BREAK YOUR LIMIT.</small></div><div id="help">WASD <span>move</span> &nbsp; SPACE <span>jump</span> &nbsp; DRAG <span>look</span></div><div id="session">ONLINE WORLD · SESSION PROGRESS</div></div><div id="entry"><div class="entry-art"><small>VYRNORA STUDIOS PRESENTS</small><h1>THE WORLD<br>IS YOUR<br><em>RUNWAY.</em></h1><p>A sun-soaked island. A thousand little discoveries.<br>Your next adventure starts with a single step.</p><span class="tag">REAL PLAYERS. ONE SHARED WORLD.</span></div><div class="entry-card"><span class="eyebrow">WELCOME TO SPEEDBOUND</span><h2>Find your fast.</h2><p>Meet in Sunburst Plaza, chase energy orbs, and turn every step into something extraordinary.</p><label for="name">YOUR RUNNER NAME</label><input id="name" maxlength="18" placeholder="Enter a name" autocomplete="nickname"><button id="join">LET’S RUN <span>→</span></button><p id="error">Guest play · Progress lasts for this session</p><div class="entry-foot"><span>ϟ Run & level up</span><span>◆ Collect together</span></div></div></div><dialog id="panel"><div class="panel-head"><h2 id="panelTitle"></h2><button id="closePanel" aria-label="Close panel">×</button></div><div id="panelBody"></div></dialog><div id="touch"><div id="stick"><span></span></div></div><button id="jump" aria-label="Jump">↑<small>JUMP</small></button>`;
  $("hello").setAttribute("aria-label", "Say hello");
  const panel = $("panel") as HTMLDialogElement;
  let active = "";
  let map: HTMLCanvasElement | undefined;
  let settings = {
    night: false,
    quality: "high",
    sensitivity: 1,
    comfort: false,
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("rift-visual-settings") || "{}",
    );
    settings = {
      night: saved.night === true,
      quality: saved.quality === "low" ? "low" : "high",
      sensitivity: Math.max(0.3, Math.min(2, Number(saved.sensitivity) || 1)),
      comfort: saved.comfort === true,
    };
  } catch {}
  let onSettings = () => {};
  function save() {
    try {
      localStorage.setItem("rift-visual-settings", JSON.stringify(settings));
    } catch {}
    onSettings();
  }
  function open(name: string) {
    active = name;
    map = undefined;
    $("panelTitle").textContent =
      {
        map: "Your island awaits",
        settings: "Make it yours",
        help: "A little momentum goes a long way",
      }[name] || "";
    if (name === "map") {
      $("panelBody").innerHTML =
        `<canvas id="mapCanvas" width="600" height="600" aria-label="Island map with your live position"></canvas><div class="district-list">${districts.map((d, i) => `<div><b>${i + 1}. ${d.name}</b><small>${d.description}</small></div>`).join("")}</div>`;
      map = $("mapCanvas") as HTMLCanvasElement;
    }
    if (name === "settings") {
      $("panelBody").innerHTML =
        `<label class="setting">Night atmosphere <input id="night" type="checkbox" ${settings.night ? "checked" : ""}></label><p class="hint">A personal visual setting. Multiplayer time and rewards are unchanged.</p><label class="setting">Graphics <select id="quality"><option value="high">High · soft shadows</option><option value="low">Low · lighter rendering</option></select></label><label class="setting">Camera sensitivity <input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="${settings.sensitivity}"></label><label class="setting">Reduce motion & particles <input id="comfort" type="checkbox" ${settings.comfort ? "checked" : ""}></label>`;
      ($("quality") as HTMLSelectElement).value = settings.quality;
      for (const id of ["night", "quality", "sensitivity", "comfort"])
        $(id).onchange = () => {
          settings.night = ($("night") as HTMLInputElement).checked;
          settings.quality = ($("quality") as HTMLSelectElement).value;
          settings.sensitivity = Number(
            ($("sensitivity") as HTMLInputElement).value,
          );
          settings.comfort = ($("comfort") as HTMLInputElement).checked;
          save();
        };
    }
    if (name === "help")
      $("panelBody").innerHTML =
        `<div class="help-grid"><article><i>ϟ</i><h3>Keep moving</h3><p>WASD or arrow keys to run. Space to jump. On touchscreens, use the joystick and jump button.</p></article><article><i>◆</i><h3>Chase the glow</h3><p>Blue → Purple → Red: higher tiers give more Steps and XP. At level 1: 2 / 5 / 10. At level 10: 10 / 25 / 50. Gold retains Gems. Shared orbs return at new positions: Blue 6–10s, Purple 10–15s, Red 14–22s.</p></article><article><i>◎</i><h3>Catch some air</h3><p>Glowing blue launch pads lift you toward rings. Pass through a ring for 20 XP; each has a 20-second personal cooldown.</p></article><article><i>⌖</i><h3>Explore together</h3><p>Drag to turn the camera, scroll to zoom. Use M for the island map, Escape to close menus. Say hello to real players.</p></article></div><div class="orb-routes">${orbRoutes.map((r) => `<p><b>${r.name}</b> · ${r.hint}</p>`).join("")}</div><p class="hint">A pickup streak is visual only; it does not multiply rewards. Progress is session-only. Leaving or reconnecting starts a new runner. Shops, pets and races are not yet available.</p>`;
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
  const numbers = { steps: 0, gems: 0, speed: 9 };
  let player: Player | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let rosterKey = "";
  let streakTimeout: ReturnType<typeof setTimeout>;
  let rewardLevel = 0;
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
      event.streak > 1 ? `${event.streak} ORB STREAK · KEEP IT FLOWING` : "";
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
    pickup,
    clearPickups,
    settings,
    panel,
    open,
    toast,
    set onSettings(fn: () => void) {
      onSettings = fn;
    },
    snapshot(p: Player, players: Record<string, Player>) {
      player = p;
      if (rewardLevel !== p.level) {
        rewardLevel = p.level;
        $("orbLegend").replaceChildren(
          ...(["blue", "purple", "red"] as const).map((tier) => {
            const e = document.createElement("span");
            e.style.setProperty(
              "--orb-color",
              "#" + ORB_TYPES[tier].color.toString(16).padStart(6, "0"),
            );
            e.textContent = `● ${tier.toUpperCase()} +${orbReward(tier, p.level).steps}`;
            return e;
          }),
        );
      }
      $("level").textContent = `LEVEL ${p.level}`;
      $("levelNumber").textContent = String(p.level);
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
