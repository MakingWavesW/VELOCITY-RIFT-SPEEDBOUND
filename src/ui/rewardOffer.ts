/** Shown only after both SDK support and authoritative server availability are confirmed. */
export function confirmReward(kind: "level" | "speed"): Promise<boolean> {
  const dialog = document.createElement("dialog");
  dialog.className = "reward-confirm";
  dialog.innerHTML = `<h2>${kind === "level" ? "+1 Level" : "2× Speed"}</h2><p>${kind === "level" ? "Watch a rewarded ad to gain exactly one level. Your partial XP is retained." : "Watch a rewarded ad for twice your running speed for 2 minutes. Boosts do not stack."}</p><p>Rewards are granted only after the server verifies completion. Skipped or failed ads earn nothing. Five-minute reward cooldown.</p><button data-confirm>Watch ad</button><button data-cancel>Cancel</button>`;
  document.body.append(dialog);
  dialog.showModal();
  return new Promise((resolve) => {
    let done = false;
    const finish = (yes: boolean) => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(yes);
    };
    dialog.querySelector<HTMLButtonElement>("[data-confirm]")!.onclick = () =>
      finish(true);
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick = () =>
      finish(false);
    dialog.oncancel = () => finish(false);
  });
}
