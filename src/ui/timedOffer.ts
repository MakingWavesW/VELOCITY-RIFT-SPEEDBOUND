import { OfferTiming } from "../../shared/offerTiming";
export function createTimedOffer(
  request: (kind: "level" | "speed" | "xp") => void,
) {
  const timing = new OfferTiming();
  let available = false,
    invitation: HTMLElement | undefined;
  const panel = document.createElement("dialog");
  panel.id = "boostCenter";
  panel.setAttribute("aria-labelledby", "boostTitle");
  document.body.append(panel);
  // Exactly five original icons from the approved GUI reference.
  // Existing authoritative reward kinds are only level, xp, speed. Do not
  // invent instant variants without corresponding verified server mechanics.
  const boosts = [
    {
      icon: "08_Rewarded_Ad.png", title: "+1 Level",
      text: "Existing verified reward: one Level, preserving partial XP.",
      kind: "level" as const, implemented: true,
    },
    {
      icon: "09_Ad_XP_Boost.png", title: "Instant XP Boost",
      text: "No secure instant-XP reward kind exists yet.",
      implemented: false,
    },
    {
      icon: "10_Ad_XP_Boost_Timer.png", title: "2× XP · 3 minutes",
      text: "Doubles eligible orb and hoop XP. Does not double Gems or Steps.",
      kind: "xp" as const, implemented: true,
    },
    {
      icon: "11_Ad_Speed_Boost.png", title: "Instant Speed Boost",
      text: "No separate instant-Speed reward kind exists yet.",
      implemented: false,
    },
    {
      icon: "12_Ad_Speed_Boost_Timer.png", title: "2× Speed · 2 minutes",
      text: "Doubles running speed temporarily. Boosts do not stack.",
      kind: "speed" as const, implemented: true,
    },
  ];
  const render = () => {
    panel.replaceChildren();
    const header = document.createElement("div");
    header.className = "panel-head";
    const h = document.createElement("h2");
    h.id = "boostTitle";
    h.textContent = "POWER BOOST CENTER";
    const closeButton = document.createElement("button");
    closeButton.setAttribute("aria-label", "Close Power Boost Center");
    closeButton.textContent = "×";
    closeButton.onclick = () => panel.close();
    header.append(h, closeButton);
    const intro = document.createElement("p");
    intro.textContent = "Five original boost icons. Only existing server-backed rewards can be claimed after trusted verification.";
    const grid = document.createElement("div");
    grid.className = "boost-grid approved-boost-grid";
    for (const [index, boost] of boosts.entries()) {
      const card = document.createElement("article");
      card.style.setProperty("--order", String(index));
      const image = document.createElement("img");
      image.src = "/media/gui/" + boost.icon;
      image.dataset.originalAsset = boost.icon;
      image.alt = "";
      image.loading = "lazy";
      image.onerror = () => {
        image.onerror = null;
        image.src = boost.kind === "speed"
          ? "/media/reward-speed.png"
          : boost.kind === "xp" ? "/media/reward-xp.png" : "/media/reward-level.png";
      };
      image.className = "boost-icon";
      const title = document.createElement("h3");
      title.textContent = boost.title;
      const description = document.createElement("p");
      description.textContent = boost.text;
      const status = document.createElement("small");
      status.textContent = !boost.implemented ? "Feature not implemented"
        : available ? "Verified offer available" : "Server verification unavailable";
      const button = document.createElement("button");
      button.textContent = boost.implemented ? "Watch Ad" : "Not available";
      button.disabled = !boost.implemented || !available;
      if (boost.kind && boost.implemented) {
        button.dataset.boost = boost.kind;
        button.onclick = () => {
          panel.close();
          request(boost.kind!);
        };
      }
      card.append(image, title, description, status, button);
      grid.append(card);
    }
    const dismiss = document.createElement("button");
    dismiss.className = "no-thanks";
    dismiss.textContent = "No thanks";
    dismiss.onclick = () => panel.close();
    panel.append(header, intro, grid, dismiss);
  };
  const close = () => {
    invitation?.remove();
    invitation = undefined;
    timing.elapsed = -120000;
    timing.sincePopup = 0;
  };
  panel.addEventListener("close", close);
  const open = () => {
    if (document.querySelector("dialog[open]")) return;
    close();
    render();
    panel.showModal();
  };
  const entry = document.createElement("button");
  entry.id = "boostCenterButton";
  entry.innerHTML = "✦ <span>Boosts</span>";
  entry.onclick = open;
  document.querySelector(".menu")!.append(entry);
  return {
    open,
    configure(value: boolean) {
      available = value;
      if (panel.open) render();
    },
    update(ms: number, playing: boolean, calm: boolean, otherPopup: boolean) {
      if (!playing) {
        invitation?.remove();
        invitation = undefined;
        return;
      }
      if (!available) return;
      if (timing.update(ms, true, calm, otherPopup || !!invitation)) {
        invitation = document.createElement("aside");
        invitation.id = "timedRewardOffer";
        invitation.innerHTML =
          '<b>Boost your next run?</b><button class="open-boost">View boosts</button><button class="dismiss-offer">No thanks</button>';
        document.body.append(invitation);
        invitation
          .querySelector(".open-boost")!
          .addEventListener("click", open);
        invitation
          .querySelector(".dismiss-offer")!
          .addEventListener("click", close);
      }
    },
    reset() {
      close();
      panel.close();
      timing.reset();
    },
  };
}
