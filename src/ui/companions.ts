import {
  CRYSTALS,
  CRYSTAL_BY_ID,
  PETS,
  PET_BY_ID,
  type PetInventory,
} from "../../shared/pets";
import type { Player } from "../../shared/game";
import { audio } from "../media/audio";
export function createCompanions(
  send: (type: string, value?: unknown) => void,
) {
  const nav = document.querySelector(".menu")!,
    button = document.createElement("button");
  button.id = "petsButton";
  button.innerHTML = "<i>✦</i><span>Pets</span>";
  button.setAttribute("aria-label", "Pets");
  nav.append(button);
  const dialog = document.createElement("dialog");
  dialog.id = "companionsPanel";
  dialog.setAttribute("aria-labelledby", "companionTitle");
  dialog.innerHTML =
    '<div class="panel-head"><h2 id="companionTitle">Your companions</h2><button id="closeCompanions" aria-label="Close companions">×</button></div><div id="companionBody"></div>';
  document.body.append(dialog);
  const interaction = document.createElement("button");
  interaction.id = "crystalInteract";
  interaction.hidden = true;
  document.body.append(interaction);
  const body = dialog.querySelector<HTMLElement>("#companionBody")!;
  let inventory: PetInventory = { owned: {}, gems: 0 },
    nearest: string | undefined,
    active: string | undefined,
    busy = false,
    lastResult = "";
  const rarity = (s: string) =>
    s === "Legendary"
      ? "#ffd66c"
      : s === "Epic"
        ? "#e5a2ff"
        : s === "Rare"
          ? "#8ddcff"
          : "#9ce6bd";
  const portrait = (id: string) => {
    const p = PET_BY_ID.get(id)!;
    return `<span class="pet-portrait ${p.shape}" style="--pet:#${p.color.toString(16).padStart(6, "0")}"><i></i></span>`;
  };
  function render() {
    if (active) {
      const c = CRYSTAL_BY_ID.get(active)!;
      dialog.querySelector("h2")!.textContent = c.name;
      body.innerHTML = `<p class="crystal-balance">${inventory.gems} Gems <span>OPEN 1 · ${c.cost} GEMS</span></p><p>Discover a companion. Every chance is shown below. Duplicates add to your collection; equip one pet at a time.</p><div class="crystal-chances">${c.drops
        .map((d) => {
          const pet = PET_BY_ID.get(d.pet)!;
          return `<article>${portrait(d.pet)}<b>${pet.name}</b><small style="color:${rarity(pet.rarity)}">${pet.rarity} · ${d.chance}%</small><small>${pet.steps}× Steps · ${pet.gems}× Gems</small></article>`;
        })
        .join(
          "",
        )}</div><button id="openCrystal" ${busy || inventory.gems < c.cost ? "disabled" : ""}>${busy ? "Opening…" : `Open 1 · ${c.cost} Gems`}</button><p class="crystal-result" role="status"></p>`;
      body.querySelector(".crystal-result")!.textContent = lastResult;
      body.querySelector<HTMLButtonElement>("#openCrystal")!.onclick = () => {
        if (busy) return;
        busy = true;
        lastResult = "";
        render();
        send("openCrystal", { crystal: active, id: crypto.randomUUID() });
      };
    } else {
      dialog.querySelector("h2")!.textContent = "Your companions";
      body.innerHTML = `<p>Collect Gems → open crystals → find a friend. One equipped companion boosts orb rewards. Pets survive rebirth.</p><p class="pet-lineup">${inventory.equipped ? `Following you: ${PET_BY_ID.get(inventory.equipped)?.name}` : "No pet equipped yet. The Sunrise Crystal is beside spawn and costs 9 Gems."}</p><div class="pet-grid">${PETS.map((p) => `<button data-pet="${p.id}" ${!inventory.owned[p.id] ? "disabled" : ""}>${portrait(p.id)}<b>${p.name}</b><small style="color:${rarity(p.rarity)}">${p.rarity}</small><small>${p.steps}× Steps · ${p.gems}× Gems</small><span>${inventory.equipped === p.id ? "Equipped · click to unequip" : inventory.owned[p.id] ? `Equip · ${inventory.owned[p.id]} owned` : "Find in crystals"}</span></button>`).join("")}</div>`;
      for (const b of body.querySelectorAll<HTMLButtonElement>("[data-pet]"))
        b.onclick = () =>
          send(
            "equipPet",
            inventory.equipped === b.dataset.pet ? null : b.dataset.pet,
          );
    }
  }
  const open = (id?: string) => {
    active = id;
    lastResult = "";
    busy = false;
    render();
    if (!dialog.open) dialog.showModal();
  };
  button.onclick = () => {
    send("petInventory");
    open();
  };
  dialog.querySelector<HTMLButtonElement>("#closeCompanions")!.onclick = () =>
    dialog.close();
  interaction.onclick = () => {
    if (nearest) {
      send("petInventory");
      open(nearest);
    }
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.key.toLowerCase() === "e" &&
      nearest &&
      !document.querySelector("dialog[open]") &&
      !(e.target as HTMLElement).matches("input,select,textarea")
    ) {
      e.preventDefault();
      interaction.click();
    }
  });
  return {
    get busy() {
      return busy;
    },
    inventory(value: PetInventory) {
      const changed = inventory.equipped !== value.equipped;
      inventory = value;
      if (changed && value.equipped) audio.effect("equip");
      if (dialog.open) render();
    },
    result(v: { pet?: string; error?: string; repeated?: boolean }) {
      busy = false;
      lastResult =
        v.error ||
        `${v.repeated ? "Already received" : "NEW COMPANION"} · ${PET_BY_ID.get(v.pet || "")?.name || "Companion"}`;
      if (!v.error && !v.repeated) audio.effect("quest");
      if (dialog.open) render();
    },
    update(p: Player | undefined) {
      nearest = undefined;
      if (p) {
        const changed = inventory.gems !== p.gems;
        inventory.gems = p.gems;
        if (changed && active && dialog.open) render();
        for (const c of CRYSTALS)
          if (Math.hypot(p.x - c.x, p.z - c.z) < 9 && p.y < 3) {
            nearest = c.id;
            break;
          }
      }
      interaction.hidden = !nearest || !!document.querySelector("dialog[open]");
      if (nearest) {
        const c = CRYSTAL_BY_ID.get(nearest)!;
        interaction.textContent = `E · ${c.name} · ${c.cost} Gems`;
      }
    },
    reset() {
      dialog.close();
      interaction.hidden = true;
      inventory = { owned: {}, gems: 0 };
      nearest = undefined;
      busy = false;
    },
  };
}
