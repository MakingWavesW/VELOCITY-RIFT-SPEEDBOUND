import * as T from "three";
import {
  TRAILS,
  TRAIL_BY_ID,
  DEFAULT_TRAIL,
  RARITY_COLORS,
  type TrailInventory,
} from "../../shared/trails";
import { createTrail } from "../world/trails";
import { createAvatar } from "../player/avatar";
export function createTrailsPanel(
  container: HTMLElement,
  equip: (id: string) => void,
) {
  let inventory: TrailInventory = {
    owned: [],
    equipped: DEFAULT_TRAIL,
    level: 1,
    sessionOnly: true,
  };
  let selected = DEFAULT_TRAIL,
    awaiting = false,
    time = 0;
  container.innerHTML = `<p class="trail-session">Session collection · Earn levels to unlock trails for free. Leaving or rejoining resets your collection. Permanent purchases are unavailable.</p>
  <div class="trail-feature"><div id="trailPreview" aria-label="Live 3D trail preview"><span>LIVE EFFECT PREVIEW</span></div><div class="trail-detail"><small id="trailRarity"></small><h3 id="trailName"></h3><div id="trailBonuses"></div><p id="trailUnlock"></p><button id="equipTrail">Equip trail</button><button id="defaultTrail" class="secondary">Return to Default</button><p id="trailStatus" role="status"></p></div></div>
  <div class="trail-filter"><label>Find a trail<input id="trailSearch" type="search" placeholder="Search 77 trails…"></label><label>Rarity<select id="trailFilter"><option value="all">All rarities</option>${Object.keys(
    RARITY_COLORS,
  )
    .map((r) => `<option>${r}</option>`)
    .join("")}</select></label></div><div id="trailGrid"></div>`;
  const el = (id: string) => container.querySelector<HTMLElement>("#" + id)!;
  const preview = el("trailPreview");
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
  renderer.setClearColor(0x14283c);
  preview.append(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(42, 2, 0.1, 100);
  camera.position.set(6, 6, 9);
  camera.lookAt(0, 1, 0);
  scene.add(new T.HemisphereLight(0xd6f9ff, 0x7185b1, 3));
  const ground = new T.Mesh(
    new T.CircleGeometry(4.8, 48),
    new T.MeshStandardMaterial({ color: 0x2b4d63, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new T.GridHelper(9, 18, 0x437a91, 0x345d75);
  grid.position.y = 0.01;
  scene.add(grid);
  const state = {
    id: "trail-preview",
    name: "",
    x: 0,
    y: 0,
    z: 0,
    velocityX: 0,
    velocityZ: 0,
    verticalVelocity: 0,
    angle: 0,
    seq: 0,
    steps: 0,
    gems: 0,
    xp: 0,
    level: 1,
    moving: true,
  };
  const avatar = createAvatar(state, false);
  scene.add(avatar.g);
  const effect = createTrail(scene);
  const resize = new ResizeObserver(() => {
    const w = preview.clientWidth,
      h = preview.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resize.observe(preview);
  function detail() {
    const d = TRAIL_BY_ID.get(selected)!,
      owned = inventory.owned.includes(selected),
      equipped = inventory.equipped === selected;
    el("trailName").textContent = d.name;
    el("trailRarity").textContent = `${d.rarity.toUpperCase()} · LEVEL 1`;
    el("trailRarity").style.color = RARITY_COLORS[d.rarity];
    el("trailBonuses").innerHTML =
      `<b>+${d.steps} Steps</b><b>+${d.gems} Gems</b>`;
    el("trailUnlock").textContent =
      d.id === DEFAULT_TRAIL
        ? "Free · Automatically owned · Neutral 1× rewards"
        : `${owned ? "Unlocked" : "Unlocks"} at runner level ${d.unlockLevel} · Free session milestone`;
    const button = el("equipTrail") as HTMLButtonElement;
    button.disabled = !owned || equipped || awaiting;
    button.textContent = awaiting
      ? "Equipping…"
      : equipped
        ? "Equipped"
        : owned
          ? "Equip trail"
          : `Locked · Level ${d.unlockLevel}`;
    (el("defaultTrail") as HTMLButtonElement).disabled =
      awaiting ||
      inventory.equipped === DEFAULT_TRAIL ||
      !inventory.owned.length;
  }
  function cards() {
    const search = (el("trailSearch") as HTMLInputElement).value.toLowerCase(),
      filter = (el("trailFilter") as HTMLSelectElement).value;
    el("trailGrid").replaceChildren(
      ...TRAILS.filter(
        (d) =>
          (filter === "all" || filter === d.rarity) &&
          d.name.toLowerCase().includes(search),
      ).map((d) => {
        const card = document.createElement("button");
        card.className = "trail-card" + (selected === d.id ? " selected" : "");
        card.dataset.trailId = d.id;
        card.dataset.rarity = d.rarity;
        card.style.setProperty("--rarity", RARITY_COLORS[d.rarity]);
        const gradient = d.rainbow
          ? "#ff8296,#ffdc76,#83f0bd,#85cfff,#ce9aff"
          : d.colors
              .map((c) => "#" + c.toString(16).padStart(6, "0"))
              .join(",");
        card.style.setProperty(
          "--trail-gradient",
          `linear-gradient(100deg,transparent,${gradient},transparent)`,
        );
        const status =
          inventory.equipped === d.id
            ? "Equipped"
            : inventory.owned.includes(d.id)
              ? "Unlocked"
              : `Locked · Lv ${d.unlockLevel}`;
        card.innerHTML = `<span class="trail-thumb ${d.family}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${d.name}</strong><small>${d.rarity} · Level 1</small><span class="trail-card-stats">+${d.steps} Steps · +${d.gems} Gems</span><span class="trail-owned">${status}</span>`;
        card.setAttribute("aria-pressed", String(selected === d.id));
        card.onclick = () => {
          selected = d.id;
          effect.setTrail(selected);
          detail();
          for (const item of container.querySelectorAll<HTMLElement>(
            ".trail-card",
          )) {
            item.classList.toggle(
              "selected",
              item.dataset.trailId === selected,
            );
            item.setAttribute(
              "aria-pressed",
              String(item.dataset.trailId === selected),
            );
          }
          el("trailName").tabIndex = -1;
          el("trailName").focus({ preventScroll: true });
          preview.parentElement!.scrollIntoView({ block: "start" });
        };
        return card;
      }),
    );
  }
  function request(id: string) {
    awaiting = true;
    el("trailStatus").textContent = "Waiting for the world…";
    detail();
    equip(id);
  }
  el("equipTrail").onclick = () => request(selected);
  el("defaultTrail").onclick = () => request(DEFAULT_TRAIL);
  el("trailSearch").oninput = cards;
  el("trailFilter").onchange = cards;
  detail();
  cards();
  return {
    inventory(value: TrailInventory) {
      inventory = value;
      awaiting = false;
      el("trailStatus").textContent =
        value.message ||
        `Equipped: ${TRAIL_BY_ID.get(value.equipped)?.name || "Default Trail"}`;
      detail();
      cards();
    },
    update(dt: number, comfort: boolean) {
      time += Math.min(dt, 0.1);
      const a = time * 1.8;
      state.x = Math.sin(a) * 2.5;
      state.z = Math.cos(a) * 2.5;
      state.velocityX = Math.cos(a) * 4.5;
      state.velocityZ = -Math.sin(a) * 4.5;
      state.angle = Math.atan2(state.velocityX, state.velocityZ);
      avatar.animate(state, time, dt);
      effect.update(avatar.g.position, time, dt, { quality: "low", comfort });
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect();
      effect.dispose();
      avatar.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      grid.geometry.dispose();
      (grid.material as T.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
