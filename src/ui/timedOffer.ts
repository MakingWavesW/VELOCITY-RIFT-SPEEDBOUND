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
  const render = () => {
    panel.innerHTML = `<div class="panel-head"><h2 id="boostTitle">BOOST CENTER</h2><button aria-label="Close Boost Center">×</button></div><p>Choose a boost when it suits your run.</p><div class="boost-grid">${(["level", "speed", "xp"] as const).map((kind, i) => `<article style="--order:${i}"><img src="/media/reward-${kind}.png" alt="${kind === "level" ? "+1 Level" : kind === "speed" ? "2× Speed" : "2× XP"}" onerror="this.hidden=true"><h3>${kind === "level" ? "+1 Level" : kind === "speed" ? "2× Speed · 2 minutes" : "2× XP · 3 minutes"}</h3><p>${kind === "xp" ? "Orb and hoop XP only. Gems and Steps stay unchanged." : kind === "speed" ? "Double movement speed. Boosts do not stack." : "Gain one level while retaining partial XP."}</p><small>${available ? "Available" : "Currently unavailable"}</small><button data-boost="${kind}" ${available ? "" : "disabled"}>Watch Ad</button></article>`).join("")}</div><button class="no-thanks">No thanks</button>`;
    for (const b of panel.querySelectorAll<HTMLButtonElement>("[data-boost]"))
      b.onclick = () => {
        panel.close();
        request(b.dataset.boost as "level" | "speed" | "xp");
      };
    panel
      .querySelector(".panel-head button")!
      .addEventListener("click", () => panel.close());
    panel
      .querySelector(".no-thanks")!
      .addEventListener("click", () => panel.close());
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
