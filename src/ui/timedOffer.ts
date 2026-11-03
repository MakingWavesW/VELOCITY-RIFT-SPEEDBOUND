import { OfferTiming } from "../../shared/offerTiming";
export function createTimedOffer(request: (kind: "level" | "speed") => void) {
  const timing = new OfferTiming();
  let element: HTMLElement | undefined,
    index = 0,
    available = false;
  const close = () => {
    element?.remove();
    element = undefined;
    timing.sincePopup = 0;
  };
  return {
    configure(value: boolean) {
      available = value;
    },
    update(ms: number, playing: boolean, calm: boolean, otherPopup: boolean) {
      if (!playing) {
        close();
        return;
      }
      if (timing.update(ms, playing, calm, otherPopup || !!element)) {
        const kind = index++ % 2 ? "speed" : "level";
        element = document.createElement("aside");
        element.id = "timedRewardOffer";
        element.setAttribute("role", "region");
        element.setAttribute("aria-label", "Optional rewarded offer");
        element.innerHTML = `<button class="offer-close" aria-label="Dismiss reward offer">×</button><small>OPTIONAL REWARD</small><img src="/media/reward-${kind}.png" alt="${kind === "level" ? "+1 Level" : "2× Speed for 2 minutes"}"><p>${available ? "Watch an ad when you choose." : "Ad rewards are currently unavailable."}</p><button class="watch-offer" ${available ? "" : "disabled"}>Watch Ad</button><button class="dismiss-offer">No thanks</button>`;
        document.body.append(element);
        element.querySelector<HTMLButtonElement>(".offer-close")!.onclick =
          close;
        element.querySelector<HTMLButtonElement>(".dismiss-offer")!.onclick =
          close;
        element.querySelector<HTMLButtonElement>(".watch-offer")!.onclick =
          () => {
            close();
            request(kind);
          };
      }
    },
    reset() {
      close();
      timing.reset();
    },
  };
}
