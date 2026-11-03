import {
  PLAYTIME,
  DAILY,
  INTRO,
  dailyQuests,
  introValue,
  TRIAL,
  type Engagement,
} from "../../shared/engagement";
import { audio } from "../media/audio";
export function createRewardHub(
  send: (type: string, value?: unknown) => void,
  toast: (text: string) => void,
) {
  const nav = document.querySelector(".menu")!;
  const art = (name: string, label: string) =>
    `<img src="/media/${name}.png" alt="${label}" onerror="this.hidden=true"><span>${label}</span>`;
  for (const [id, label, file] of [
    ["playtime", "Playtime", "playtime-rewards"],
    ["daily", "Daily rewards", "daily-rewards"],
    ["quests", "Goals", ""],
  ]) {
    const b = document.createElement("button");
    b.id = `${id}Button`;
    b.className = "reward-nav";
    b.setAttribute("aria-label", label);
    b.innerHTML =
      (file ? art(file, label) : `<span>✦ ${label}</span>`) +
      `<b class="ready-badge" hidden>!</b>`;
    b.onclick = () => open(id);
    nav.append(b);
  }
  const panel = document.createElement("dialog");
  panel.id = "rewardHub";
  panel.setAttribute("aria-labelledby", "hubTitle");
  panel.innerHTML =
    '<div class="panel-head"><h2 id="hubTitle"></h2><button aria-label="Close rewards">×</button></div><div id="hubBody"></div>';
  document.body.append(panel);
  panel.querySelector("button")!.onclick = () => panel.close();
  const guide = document.createElement("section");
  guide.id = "beginnerGuide";
  guide.innerHTML =
    "<b>Your next goal</b><span>Collect five Blue orbs</span><button>Goals →</button>";
  guide.querySelector("button")!.onclick = () => open("quests");
  document.body.append(guide);
  let state: Engagement | undefined,
    server = 0,
    received = 0,
    tab = "playtime",
    pending = false,
    trial: { start: number; checkpoint: number } | undefined;
  const time = () => server + performance.now() - received;
  const clock = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s >= 3600)
      return `${Math.floor(s / 3600)}:${Math.floor((s % 3600) / 60)
        .toString()
        .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    return `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };
  function badge(id: string, ready: boolean) {
    const b = document.querySelector(`#${id}Button`)!;
    b.classList.toggle("reward-ready", ready);
    b.querySelector<HTMLElement>(".ready-badge")!.hidden = !ready;
  }
  const card = (
    id: string,
    title: string,
    text: string,
    ready: boolean,
    claimed: boolean,
    kind: string,
  ) =>
    `<article class="reward-card ${ready ? "ready" : ""} ${claimed ? "claimed" : ""}"><b>${title}</b><p>${text}</p><button data-kind="${kind}" data-id="${id}" ${!ready || pending ? "disabled" : ""}>${claimed ? "✓ Claimed" : ready ? "Claim" : "Locked"}</button></article>`;
  let renderKey = "";
  function render() {
    if (!state || !panel.open) return;
    const countdown = panel.querySelector("#dailyCountdown");
    if (countdown)
      countdown.textContent = clock((state.day + 1) * 86400000 - time());
    const nextKey = JSON.stringify([tab, state, pending, trial]);
    if (nextKey === renderKey) return;
    renderKey = nextKey;
    const s = state,
      body = panel.querySelector("#hubBody")!,
      focus = (document.activeElement as HTMLElement)?.dataset;
    panel.querySelector("h2")!.textContent =
      tab === "playtime"
        ? "PLAYTIME REWARDS"
        : tab === "daily"
          ? "DAILY REWARDS"
          : "YOUR CITY GOALS";
    if (tab === "playtime")
      body.innerHTML = `<p>Active running: <b>${clock(s.activeMs)}</b> · resets at 00:00 UTC. Run in the foreground to progress.</p><div class="reward-grid">${PLAYTIME.map((r, i) => card(String(i), `${r.seconds / 60} minutes`, `${r.gems} Gems · ${s.activeMs >= r.seconds * 1000 ? "Ready" : clock(r.seconds * 1000 - s.activeMs) + " active time remaining"}`, s.activeMs >= r.seconds * 1000 && !s.playClaims.includes(i), s.playClaims.includes(i), "playtime")).join("")}</div>`;
    else if (tab === "daily") {
      const index =
        s.dailyLast === s.day
          ? s.dailyIndex
          : s.dailyLast === s.day - 1
            ? (s.dailyIndex + 1) % 7
            : 0;
      body.innerHTML = `<p>One claim per UTC day. Consecutive days advance the calendar; missing a day restarts at Day 1.</p><p>Next UTC reset: <b id="dailyCountdown">${clock((s.day + 1) * 86400000 - time())}</b></p><div class="reward-grid calendar">${DAILY.map((g, i) => card("daily", `Day ${i + 1}${i === 6 ? " · GRAND GIFT" : ""}`, `${g} Gems`, i === index && s.dailyLast < s.day, i < index || (s.dailyLast === s.day && i === index), "daily")).join("")}</div>`;
    } else {
      const next = INTRO.find((r) => !s.introClaims.includes(r.id));
      body.innerHTML = `<p>Small rewards for real gameplay. Complete the beginner path in order.</p><div class="reward-grid">${INTRO.map((r) => card(r.id, r.title, `${r.hint} · ${Math.min(r.goal, introValue(s, r.id))}/${r.goal} · ${r.gems} Gems`, next?.id === r.id && introValue(s, r.id) >= r.goal, s.introClaims.includes(r.id), "intro")).join("")}</div><h3>Today’s goals · UTC</h3><div class="reward-grid">${dailyQuests(
        s.day,
      )
        .map((r) =>
          card(
            r.id,
            r.title,
            `${r.hint} · ${Math.min(r.goal, Math.floor(s.dailyCounts[r.id] || 0))}/${r.goal} · ${r.gems} Gems`,
            (s.dailyCounts[r.id] || 0) >= r.goal &&
              !s.questClaims.includes(r.id),
            s.questClaims.includes(r.id),
            "quest",
          ),
        )
        .join(
          "",
        )}</div><h3>${TRIAL.name}</h3><p>Start at spawn, run north through both checkpoints, then return. 8 Gems, five-minute reward cooldown. Best: ${s.bestMs ? (s.bestMs / 1000).toFixed(2) + "s" : "No finish yet"}.</p><button id="startTrial" ${trial ? "disabled" : ""}>${trial ? "Trial active" : "Start at spawn"}</button>`;
      body.querySelector<HTMLButtonElement>("#startTrial")!.onclick = () => {
        send("startTrial");
        panel.close();
      };
    }
    for (const b of body.querySelectorAll<HTMLButtonElement>("[data-kind]"))
      b.onclick = () => {
        if (pending) return;
        pending = true;
        send("claimEngagement", { kind: b.dataset.kind, id: b.dataset.id });
        render();
      };
    if (focus?.kind)
      body
        .querySelector<HTMLButtonElement>(
          `[data-kind="${focus.kind}"][data-id="${focus.id}"]`,
        )
        ?.focus({ preventScroll: true });
  }
  function open(value: string) {
    if (document.querySelector("dialog[open]")) return;
    tab = value;
    panel.showModal();
    send("engagement");
    render();
  }
  return {
    get trialActive() {
      return !!trial;
    },
    update(v: { state: Engagement; time: number; trial?: typeof trial }) {
      state = v.state;
      server = v.time;
      received = performance.now();
      trial = v.trial;
      const s = state;
      badge(
        "playtime",
        PLAYTIME.some(
          (r, i) => s.activeMs >= r.seconds * 1000 && !s.playClaims.includes(i),
        ),
      );
      badge("daily", s.dailyLast < s.day);
      const next = INTRO.find((r) => !s.introClaims.includes(r.id));
      guide.querySelector("b")!.textContent = trial
        ? "PLAZA DASH"
        : next?.title || "Keep exploring Main City";
      guide.querySelector("span")!.textContent = trial
        ? v.time < trial.start
          ? `Starts in ${Math.ceil((trial.start - v.time) / 1000)}…`
          : `Checkpoint ${trial.checkpoint + 1}/4 · ${clock(v.time - trial.start)} · ${trial.checkpoint < 2 ? "Run north to" : "Run south to"} z ${TRIAL.points[trial.checkpoint].z}`
        : next
          ? `${next.hint} · ${Math.min(next.goal, introValue(s, next.id))}/${next.goal}`
          : "Open Goals for today’s challenges";
      render();
    },
    result(v: { ok: boolean; message: string }) {
      pending = false;
      toast(v.message);
      if (v.ok) audio.effect("quest");
      render();
    },
    show(value: boolean) {
      guide.hidden = !value;
      if (!value) {
        panel.close();
        pending = false;
      }
    },
    open,
  };
}
