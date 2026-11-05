import { CRYSTALS } from "../../shared/pets";
import type { Player } from "../../shared/game";

/**
 * Approved 20-icon HUD layout. Reparents the original functional controls,
 * preserving their existing onclick listeners; builds only read-only menus for
 * features without an authoritative backend.
 *
 * Requires the original supplied icons in public/media/gui. When the external
 * PNG overlay is missing, each icon has an explicit fallback, never an empty
 * square or a broken-image glyph.
 */
type Icon = { file: string; title: string; fallback?: string; glyph?: string };
type Milestone = { title: string; description: string; completed: boolean; current: number; goal: number };
const model: Record<string, Icon> = {
  rebirth: { file: "01_Rebirth.png", title: "Rebirth", fallback: "/media/rebirth.png" },
  trails: { file: "02_Trails.png", title: "Trails", fallback: "/media/trails.png" },
  settings: { file: "03_Settings.png", title: "Settings", fallback: "/media/settings.png" },
  pets: { file: "04_Pets.png", title: "Pets", glyph: "🐾" },
  shop: { file: "05_Shop.png", title: "Crystal Shop", glyph: "💎" },
  daily: { file: "06_Daily_Rewards.png", title: "Daily Rewards", fallback: "/media/daily-rewards.png" },
  playtime: { file: "07_Playtime_Rewards.png", title: "Playtime Rewards", fallback: "/media/playtime-rewards.png" },
  leaderboard: { file: "13_Leaderboard.png", title: "Live Room Leaderboard", glyph: "🏆" },
  race: { file: "14_Race.png", title: "Skybound Courses", glyph: "🏁" },
  world: { file: "15_World_Teleport.png", title: "World Map (teleport unavailable)", glyph: "🗺️" },
  quests: { file: "16_Daily_Quests.png", title: "Daily Quests and Goals", glyph: "🎯" },
  achievements: { file: "17_Achievements.png", title: "Runner Journey Achievements", glyph: "🏅" },
  inventory: { file: "18_Inventory.png", title: "Inventory", glyph: "🎒" },
  power: { file: "19_Power_Boost.png", title: "Power Boost Center", fallback: "/media/reward-xp.png" },
  codes: { file: "20_Redeem_Codes.png", title: "Redeem Codes (not yet supported)", glyph: "🎟️" },
};
const url = (filename: string) => "/media/gui/" + filename;

function skin(button: HTMLButtonElement, key: string) {
  const info = model[key];
  button.classList.add("compact-game-icon", "hud-icon-" + key);
  button.setAttribute("aria-label", info.title);
  button.title = info.title;
  button.draggable = false;
  // Preserve the reward hub's real claimable badge and its state.
  const badge = button.querySelector<HTMLElement>(".ready-badge");
  button.replaceChildren();
  const image = document.createElement("img");
  image.alt = "";
  image.draggable = false;
  image.decoding = "async";
  image.src = url(info.file);
  image.onerror = () => {
    image.onerror = null;
    if (info.fallback) {
      image.src = info.fallback;
      return;
    }
    image.remove();
    const glyph = document.createElement("i");
    glyph.textContent = info.glyph || "✦";
    glyph.setAttribute("aria-hidden", "true");
    button.prepend(glyph);
  };
  button.append(image);
  if (badge) button.append(badge);
  return button;
}

function addButton(id: string) {
  const el = document.createElement("button");
  el.id = id;
  el.type = "button";
  return el;
}
function makeDock(id: string, label: string, root: HTMLElement) {
  const dock = document.createElement("nav");
  dock.id = id;
  dock.setAttribute("aria-label", label);
  dock.className = "approved-icon-dock";
  root.append(dock);
  return dock;
}

export function installIconChrome() {
  const hud = document.querySelector<HTMLElement>("#hud");
  const menu = document.querySelector<HTMLElement>(".menu");
  if (!hud || !menu) throw Error("Game HUD must be initialized before icon layout");

  const topRight = makeDock("settingsDock", "Settings shortcut", hud);
  const left = makeDock("rewardDock", "Daily and playtime progression", hud);
  const bottom = makeDock("primaryGameDock", "Main game actions", hud);
  const right = makeDock("socialDock", "Live players and codes", hud);

  const required = (selector: string) => {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (!button) throw Error("Missing existing gameplay control: " + selector);
    return button;
  };
  const move = (dock: HTMLElement, selector: string, key: string) =>
    dock.append(skin(required(selector), key));

  // Exactly one gameplay Settings icon; original main-menu Settings stays.
  move(topRight, '.menu [data-panel="settings"].gear', "settings");

  // The order is intentional and mirrors the supplied approved placement board.
  move(left, "#dailyButton", "daily");
  move(left, "#playtimeButton", "playtime");
  move(left, "#questsButton", "quests");
  const achievement = addButton("achievementsButton");
  achievement.onclick = () => show("achievements");
  left.append(skin(achievement, "achievements"));

  move(bottom, '.menu [data-panel="rebirth"]', "rebirth");
  move(bottom, '.menu [data-panel="trails"]', "trails");
  move(bottom, "#petsButton", "pets");
  const shop = addButton("shopButton");
  shop.onclick = () => show("shop");
  bottom.append(skin(shop, "shop"));
  const inventory = addButton("inventoryButton");
  inventory.onclick = () => show("inventory");
  bottom.append(skin(inventory, "inventory"));
  move(bottom, '.menu [data-panel="map"]', "world");
  move(bottom, "#parkourButton", "race");
  move(bottom, "#boostCenterButton", "power");

  const leaderboard = addButton("leaderboardButton");
  leaderboard.onclick = () => show("leaderboard");
  right.append(skin(leaderboard, "leaderboard"));
  const codes = addButton("redeemCodesButton");
  codes.onclick = () => show("codes");
  right.append(skin(codes, "codes"));

  // Help and Hello have existing handlers. Keep both usable, but avoid extra
  // top-level HUD buttons by including them in the social panel as text actions.
  const originalHelp = required('.menu [data-panel="help"]');
  const originalHello = required("#hello");
  const utilities = document.createElement("div");
  utilities.id = "originalUtilityActions";
  utilities.hidden = true;
  utilities.append(originalHelp, originalHello);
  hud.append(utilities);

  const popup = document.createElement("dialog");
  popup.id = "approvedMenu";
  popup.setAttribute("aria-labelledby", "approvedMenuTitle");
  popup.innerHTML =
    '<div class="panel-head"><h2 id="approvedMenuTitle"></h2>' +
    '<button id="closeApprovedMenu" type="button" aria-label="Close menu">×</button></div>' +
    '<div id="approvedMenuContent"></div>';
  document.body.append(popup);
  const title = popup.querySelector<HTMLElement>("#approvedMenuTitle")!;
  const content = popup.querySelector<HTMLElement>("#approvedMenuContent")!;
  popup.querySelector<HTMLButtonElement>("#closeApprovedMenu")!.onclick = () => popup.close();

  let players: Pick<Player, "name" | "level" | "steps">[] = [];
  let achievements: () => Milestone[] = () => [];
  let active = "";
  function text(parent: HTMLElement, tag: "p" | "h3" | "small", value: string) {
    const el = document.createElement(tag);
    el.textContent = value;
    parent.append(el);
    return el;
  }
  function action(parent: HTMLElement, label: string, callback: () => void) {
    const b = addButton("action-" + Math.random().toString(36).slice(2, 8));
    b.className = "approved-menu-action";
    b.textContent = label;
    b.onclick = () => {
      popup.close();
      callback();
    };
    parent.append(b);
  }
  function render() {
    content.replaceChildren();
    if (active === "shop") {
      title.textContent = "Crystal Shop · Main City";
      text(content, "p", "Inspect real Crystal prices and locations. Buying still requires visiting the actual crystal in the world.");
      for (const crystal of CRYSTALS) {
        const card = document.createElement("article");
        card.className = "approved-menu-card";
        text(card, "h3", crystal.name);
        text(card, "p", crystal.cost + " Gems · X " + crystal.x + " / Z " + crystal.z);
        text(card, "small", crystal.drops.map((x) => x.chance + "% " + x.pet).join(" · "));
        content.append(card);
      }
      action(content, "View the Main City map", () => required('[data-panel="map"]').click());
    } else if (active === "inventory") {
      title.textContent = "Your Inventory";
      text(content, "p", "Choose the collection you want to inspect or equip. All ownership remains server-authoritative.");
      action(content, "Open Pets and Companions", () => required("#petsButton").click());
      action(content, "Open Trails Collection", () => required('[data-panel="trails"]').click());
    } else if (active === "leaderboard") {
      title.textContent = "Live Room Leaderboard";
      text(content, "p", "Actual connected runners in this room. Global/all-time rankings are not implemented.");
      if (!players.length) text(content, "p", "Join a multiplayer world to see other runners.");
      const ordered = [...players].sort((a, b) => b.level - a.level || b.steps - a.steps);
      const list = document.createElement("ol");
      list.className = "live-room-players";
      for (const p of ordered) {
        const item = document.createElement("li");
        item.textContent = p.name + " · Level " + p.level + " · " + Math.floor(p.steps) + " Steps";
        list.append(item);
      }
      content.append(list);
      action(content, "How to Play", () => originalHelp.click());
      action(content, "Say Hello", () => originalHello.click());
    } else if (active === "achievements") {
      title.textContent = "Runner Journey Achievements";
      text(content, "p", "Your current-session challenges. These are progress milestones, not permanent platform trophies or paid rewards.");
      const tasks = achievements();
      if (!tasks.length) text(content, "p", "Start running to see your journey progress.");
      for (const m of tasks) {
        const card = document.createElement("article");
        card.className = "approved-menu-card";
        text(card, "h3", (m.completed ? "✓ " : "") + m.title);
        text(card, "p", m.description + " · " + Math.min(m.current, m.goal) + " / " + m.goal);
        content.append(card);
      }
    } else if (active === "codes") {
      title.textContent = "Redeem Codes";
      text(content, "p", "Code redemption is not available in this game version. No code-validation or reward-grant backend exists yet.");
      text(content, "small", "The icon is provided for the approved GUI layout, but no codes can be redeemed. No fake codes or rewards are offered.");
    }
  }
  function show(kind: string) {
    if (document.querySelector("dialog[open]")) return;
    active = kind;
    render();
    popup.showModal();
  }
  const portrait = document.createElement("div");
  portrait.id = "landscapeOrientation";
  portrait.setAttribute("role", "status");
  portrait.innerHTML =
    '<span aria-hidden="true">↻</span><strong>Rotate your device</strong>' +
    '<p>VELOCITY RIFT is designed for landscape play.</p>';
  document.body.append(portrait);
  return {
    updatePlayers(values: Record<string, Player>) {
      players = Object.values(values).map((p) => ({ name: p.name, level: p.level, steps: p.steps }));
      if (popup.open && active === "leaderboard") render();
    },
    setAchievementsProvider(callback: () => Milestone[]) {
      achievements = callback;
    },
    get buttons() {
      return [...topRight.querySelectorAll("button"), ...left.querySelectorAll("button"),
        ...bottom.querySelectorAll("button"), ...right.querySelectorAll("button")];
    },
  };
}
