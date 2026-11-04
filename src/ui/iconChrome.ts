/**
 * Stage 4: user-supplied small icon skin. UI actions remain attached to their
 * original buttons. The optional 20-PNG overlay lives in /public/media/gui.
 * If it has not been installed, the game's original supported assets survive.
 */
type IconSpec = {
  selector: string;
  filename?: string;
  fallback?: string;
  emoji?: string;
  title: string;
};
const icons: IconSpec[] = [
  { selector: '[data-panel="rebirth"].official', filename: "01_Rebirth.png", fallback: "/media/rebirth.png", title: "Rebirth" },
  { selector: '[data-panel="trails"].official', filename: "02_Trails.png", fallback: "/media/trails.png", title: "Trails" },
  { selector: '[data-panel="settings"].gear', filename: "03_Settings.png", fallback: "/media/settings.png", title: "Settings" },
  { selector: "#petsButton", filename: "04_Pets.png", emoji: "🐾", title: "Pets" },
  { selector: "#dailyButton", filename: "06_Daily_Rewards.png", fallback: "/media/daily-rewards.png", title: "Daily Rewards" },
  { selector: "#playtimeButton", filename: "07_Playtime_Rewards.png", fallback: "/media/playtime-rewards.png", title: "Playtime Rewards" },
  { selector: "#boostCenterButton", filename: "08_Rewarded_Ad.png", fallback: "/media/reward-xp.png", title: "Boost Center" },
  { selector: "#questsButton", filename: "16_Daily_Quests.png", emoji: "🎯", title: "Campaign and Goals" },
  { selector: "#parkourButton", filename: "14_Race.png", emoji: "🏁", title: "Skybound parkour" },
  { selector: '[data-panel="map"]', filename: "15_World_Teleport.png", emoji: "🗺️", title: "World Map" },
  { selector: '[data-panel="help"]', emoji: "❔", title: "How to play" },
  { selector: "#hello", emoji: "👋", title: "Say hello" },
];

export function installIconChrome() {
  const hud = document.querySelector<HTMLElement>("#hud");
  const menu = document.querySelector<HTMLElement>(".menu");
  if (!hud || !menu) return;
  const dock = document.createElement("nav");
  dock.id = "rewardDock";
  dock.setAttribute("aria-label", "Campaign and reward shortcuts");
  hud.append(dock);

  for (const spec of icons) {
    const button = document.querySelector<HTMLButtonElement>(spec.selector);
    if (!button) continue;
    button.classList.add("compact-game-icon");
    button.setAttribute("aria-label", spec.title);
    button.title = spec.title;

    const badge = button.querySelector(".ready-badge");
    button.replaceChildren();
    if (spec.filename) {
      const image = document.createElement("img");
      image.alt = "";
      image.draggable = false;
      image.decoding = "async";
      image.src = "/media/gui/" + spec.filename;
      image.onerror = () => {
        image.onerror = null;
        if (spec.fallback) image.src = spec.fallback;
        else {
          image.remove();
          const symbol = document.createElement("i");
          symbol.textContent = spec.emoji || "✦";
          symbol.setAttribute("aria-hidden", "true");
          button.prepend(symbol);
        }
      };
      button.append(image);
    } else {
      const symbol = document.createElement("i");
      symbol.textContent = spec.emoji || "✦";
      symbol.setAttribute("aria-hidden", "true");
      button.append(symbol);
    }
    if (badge) button.append(badge);
  }

  // The original click listeners survive DOM moves; no duplicate Settings,
  // reward claims or placeholder menus are created.
  const settings = menu.querySelector<HTMLButtonElement>('[data-panel="settings"].gear');
  if (settings) {
    settings.classList.add("settings-launcher");
    hud.append(settings);
  }
  for (const id of ["questsButton", "dailyButton", "playtimeButton"]) {
    const b = document.getElementById(id);
    if (b) dock.append(b);
  }
  const orient = document.createElement("div");
  orient.id = "landscapeOrientation";
  orient.setAttribute("role", "status");
  orient.innerHTML =
    '<span aria-hidden="true">↻</span><strong>Rotate your device</strong>' +
    "<p>VELOCITY RIFT is designed for landscape play.</p>";
  document.body.append(orient);
}
