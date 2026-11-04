import { createRewardHub } from "./ui/rewardHub";
import { createParkourUI } from "./ui/parkour";
import { installDialogMotion } from "./ui/motion";
import { createCompanions } from "./ui/companions";
import { createPetRenderer } from "./world/pets";
import { createTimedOffer } from "./ui/timedOffer";
import { daylight } from "../shared/dayNight";
import { platform } from "./platform/bridge";
import { confirmReward } from "./ui/rewardOffer";
import { audio } from "./media/audio";
import { startup, setMediaState, inputPaused } from "./media/startup";
import { LevelCelebration } from "./ui/celebration";
const celebration = new LevelCelebration();
import { createTrail } from "./world/trails";
import { DEFAULT_TRAIL, type TrailInventory } from "../shared/trails";
import { NETWORK, SnapshotBuffer } from "./network/snapshots";
import { createOrbRenderer } from "./world/orbs";
import {
  type OrbState,
  type OrbPatch,
  type PickupEvent,
  ORB_TYPES,
} from "../shared/orbs";
import * as T from "three";
import { Client, type Room } from "colyseus.js";
import {
  DT,
  move,
  actualSpeed,
  angleDelta,
  type Player,
  type Input,
} from "../shared/game";
import { hoops } from "../shared/world";
import { createWorld } from "./world/environment";
import { createAvatar } from "./player/avatar";
import { createEffects } from "./world/effects";
import { createHud, $ } from "./ui/hud";
import { createJourneyUI } from "./ui/journey";
import "./style.css";

installDialogMotion();
const hud = createHud();
const rewardHub = createRewardHub(
  (type, value) => room?.send(type, value),
  (text) => hud.toast(text),
);
rewardHub.show(false);
const parkourUI = createParkourUI(
  (type, value) => {
    if (connected) room?.send(type, value);
    else hud.toast("Join a world first.");
  },
  (text) => hud.toast(text),
);
parkourUI.show(false);
const companions = createCompanions((type, value) => {
  if (connected) room?.send(type, value);
  else hud.toast("Join a world first.");
});
const timedOffer = createTimedOffer((kind) => hud.onRewardRequest(kind));
const journeyUI = createJourneyUI();
journeyUI.onComplete = () => audio.effect("quest");
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1800);
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.prepend(renderer.domElement);
const orbRenderer = createOrbRenderer(scene);
const petRenderer = createPetRenderer(scene);
const world = createWorld(scene),
  effects = createEffects(scene);
function applySettings() {
  document.body.classList.toggle("reduced-motion", hud.settings.comfort);
  world.setQuality(hud.settings.quality, hud.settings.comfort);
  world.setNight(hud.settings.night);
  world.setCycle(hud.settings.dayCycle);
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      hud.settings.quality === "low"
        ? 0.85
        : hud.settings.quality === "medium"
          ? 1
          : 1.5,
    ),
  );
  renderer.shadowMap.enabled =
    hud.settings.shadows && hud.settings.quality !== "low";
  audio.configure(hud.settings);
}
hud.onSettings = applySettings;
applySettings();
const trails = new Map<
  string,
  { effect: ReturnType<typeof createTrail>; reset: number }
>();
const avatars = new Map<string, ReturnType<typeof createAvatar>>();
let states: Record<string, Player> = {},
  local: Player | undefined,
  room: Room | undefined,
  seq = 0,
  pending: Input[] = [],
  connected = false;
const buffers = new Map<string, SnapshotBuffer>();
const correction = new T.Vector3();
let localPrevious: Player | undefined,
  lastPrediction = performance.now();
let lastSnapshot = 0,
  serverOffset = 0,
  lastServerTime = 0;
let confirmedVertical: number | undefined;
let predictionError = 0,
  correctionDistance = 0,
  hardCorrections = 0,
  rtt = 0;
let lastOrbSync = 0;
let offeredReward: "level" | "speed" | "xp" | undefined;
let rewardBusy = false;
let lastPresence: boolean | undefined;
function requestOrbSync() {
  if (room && performance.now() - lastOrbSync > 1000) {
    lastOrbSync = performance.now();
    room.send("orbSync");
  }
}
const keys = new Set<string>();
let yaw = 0,
  cameraYaw = 0,
  distance = 22,
  drag = false,
  jump = false,
  stickX = 0,
  stickZ = 0;
const target = new T.Vector3(),
  desired = new T.Vector3(),
  direction = new T.Vector3(),
  hit = new T.Vector3(),
  ray = new T.Ray();
const cameraBoxes = world.cameraSolids.map(
  (s) =>
    new T.Box3(
      new T.Vector3(s.x - s.w / 2 - 0.5, -1, s.z - s.d / 2 - 0.5),
      new T.Vector3(s.x + s.w / 2 + 0.5, s.h + 0.7, s.z + s.d / 2 + 0.5),
    ),
);
function clearInput() {
  keys.clear();
  jump = false;
  stickX = stickZ = 0;
  ($("stick").firstElementChild as HTMLElement).style.transform = "";
}
onkeydown = (e) => {
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (
    e.key === "F3" &&
    (import.meta as unknown as { env: { DEV: boolean } }).env.DEV
  ) {
    e.preventDefault();
    const overlay = document.getElementById("networkDiagnostics");
    if (overlay) overlay.hidden = !overlay.hidden;
    return;
  }
  if (e.key.toLowerCase() === "m" && connected) {
    clearInput();
    hud.open("map");
    return;
  }
  if (document.querySelector("dialog[open]") || !connected || inputPaused())
    return;
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.code === "Space" && !e.repeat) jump = true;
};
onkeyup = (e) => keys.delete(e.key.toLowerCase());
onblur = clearInput;
document.addEventListener("visibilitychange", () => {
  clearInput();
});
hud.panel.addEventListener("close", clearInput);
renderer.domElement.onpointerdown = (e) => {
  drag = true;
  renderer.domElement.setPointerCapture(e.pointerId);
};
renderer.domElement.onpointerup = renderer.domElement.onpointercancel = () =>
  (drag = false);
renderer.domElement.style.touchAction = "none";
renderer.domElement.onpointermove = (e) => {
  if (drag) yaw -= e.movementX * 0.006 * hud.settings.sensitivity;
};
renderer.domElement.onwheel = (e) => {
  distance = T.MathUtils.clamp(distance + e.deltaY * 0.015, 9, 55);
};
const stick = $("stick");
let stickPointer: number | undefined;
function updateStick(e: PointerEvent) {
  const r = stick.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / 40,
    z = (e.clientY - r.top - r.height / 2) / 40;
  const n = Math.max(1, Math.hypot(x, z));
  stickX = x / n;
  stickZ = z / n;
  (stick.firstElementChild as HTMLElement).style.transform =
    `translate(${stickX * 30}px,${stickZ * 30}px)`;
}
stick.onpointerdown = (e) => {
  stickPointer = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  updateStick(e);
};
stick.onpointermove = (e) => {
  if (e.pointerId === stickPointer) updateStick(e);
};
stick.onpointerup = stick.onpointercancel = () => {
  stickPointer = undefined;
  clearInput();
};
$("jump").onpointerdown = () => {
  if (!hud.panel.open) jump = true;
};
hud.onEquip = (id) => {
  if (connected) room?.send("equipTrail", id);
  else hud.toast("Join a world to equip a trail.");
};
$("hello").onclick = () => {
  if (connected) room?.send("hello");
};
function setStatus(text: string) {
  $("connection").textContent = text;
}
$("join").onclick = async () => {
  const button = $("join") as HTMLButtonElement;
  button.disabled = true;
  setMediaState("CONNECTING");
  void audio.unlock().catch(() => {});
  $("error").textContent = "Finding your world…";
  try {
    const endpoint =
      (import.meta as unknown as { env: Record<string, string> }).env
        .VITE_SERVER_URL ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
    let resumeToken: string | undefined;
    try {
      resumeToken = localStorage.getItem("rift-runner-token") || undefined;
    } catch {}
    room = await new Client(endpoint).joinOrCreate("plaza", {
      name: ($("name") as HTMLInputElement).value,
      resumeToken,
    });
    room.onMessage("profile", (v: { token: string }) => {
      try {
        localStorage.setItem("rift-runner-token", v.token);
      } catch {
        hud.toast(
          "Storage unavailable: this runner cannot be restored after leaving.",
        );
      }
    });
    room.send("profile");
    room.onMessage("petInventory", (v) => companions.inventory(v));
    room.onMessage("crystalResult", (v) => companions.result(v));
    room.send("petInventory");
    room.onMessage("engagement", (v) => rewardHub.update(v));
    room.onMessage("engagementResult", (v) => rewardHub.result(v));
    room.send("engagement");
    room.onMessage("parkour", (event) => parkourUI.update(event));
    room.send("rewardOffer");
    room.onMessage("progression", (v: { ok: boolean; message: string }) => {
      hud.toast(v.message);
      if (v.ok) {
        hud.panel.close();
        audio.effect("rebirth");
      }
    });
    room.onMessage(
      "rewardOffer",
      async (v: { available: boolean; message: string }) => {
        timedOffer.configure(v.available && platform.rewardsSupported);
        const kind = offeredReward;
        if (!kind) return;
        offeredReward = undefined;
        if (!v.available || !platform.rewardsSupported || !kind) {
          rewardBusy = false;
          hud.toast(v.message);
          return;
        }
        clearInput();
        if (await confirmReward(kind)) room?.send("rewardPrepare", { kind });
        else rewardBusy = false;
      },
    );
    room.onMessage(
      "rewardTransaction",
      (v: { id?: string; kind?: "level" | "speed" | "xp"; error?: string }) => {
        if (!v.id || !v.kind) {
          rewardBusy = false;
          hud.toast(v.error || "Reward unavailable.");
          return;
        }
        const transaction = v.id,
          activeRoom = room;
        clearInput();
        room?.send("presence", false);
        setMediaState("AD_PLAYBACK");
        // Placement IDs are presentation routing, not verification proof.
        const shown = platform.showRewarded(`rift_${v.kind}`, () => {
          setMediaState(connected ? "GAMEPLAY" : "MAIN_MENU");
          rewardBusy = false;
          if (connected && room === activeRoom)
            room?.send("rewardCheck", { id: transaction });
        });
        if (!shown) {
          rewardBusy = false;
          setMediaState("GAMEPLAY");
          hud.toast("No rewarded advertisement is available.");
        }
      },
    );
    room.onMessage("rewardResult", (v: { ok: boolean; message: string }) =>
      hud.toast(v.message),
    );
    celebration.reset();
    confirmedVertical = undefined;
    setMediaState("GAMEPLAY");
    lastPresence = undefined;
    seq = 0;
    pending = [];
    local = undefined;
    states = {};
    buffers.clear();
    correction.set(0, 0, 0);
    localPrevious = undefined;
    lastServerTime = 0;

    orbRenderer.clear();
    lastOrbSync = -Infinity;
    connected = true;
    journeyUI.reset();
    journeyUI.show();
    rewardHub.show(true);
    parkourUI.show(true);
    clearInput();
    $("entry").style.display = "none";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.focus();
    setStatus("● JOINING WORLD");
    room.onMessage(
      "snapshot",
      (s: {
        players: Record<string, Player>;
        orbRevision: number;
        time: number;
      }) => {
        if (s.time <= lastServerTime) return;
        lastServerTime = s.time;
        const received = performance.now(),
          offset = s.time - received;
        serverOffset = lastSnapshot
          ? serverOffset +
            T.MathUtils.clamp((offset - serverOffset) * 0.03, -1, 1)
          : offset;
        lastSnapshot = received;
        states = s.players;
        for (const [id, state] of Object.entries(states)) {
          if (id === room?.sessionId) continue;
          let buffer = buffers.get(id);
          if (!buffer) {
            buffer = new SnapshotBuffer();
            buffers.set(id, buffer);
          }
          if (buffer.push(s.time, state)) avatars.get(id)?.resetMotion();
        }
        const p = states[room!.sessionId];
        if (p) {
          const previous = local?.level;
          celebration.snapshot(p.level, hud.settings.comfort);
          if (confirmedVertical === 0 && p.verticalVelocity > 1)
            audio.effect(p.verticalVelocity > 15 ? "boost" : "jump");
          if (
            confirmedVertical !== undefined &&
            confirmedVertical < -1 &&
            p.verticalVelocity === 0
          )
            audio.effect("landing");
          confirmedVertical = p.verticalVelocity;
          const before = local;
          pending = pending.filter((i) => i.seq > p.seq);
          local = { ...p };
          for (const i of pending) move(local, i);
          if (before) {
            const dx = before.x - local.x,
              dy = before.y - local.y,
              dz = before.z - local.z;
            predictionError = Math.hypot(dx, dy, dz);
            if (predictionError > NETWORK.hardCorrection) {
              correction.set(0, 0, 0);
              localPrevious = { ...local };
              hardCorrections++;
              avatars.get(p.id)?.resetMotion();
            } else {
              correction.add(new T.Vector3(dx, dy, dz));
              // Move both ends of the render interpolation into the corrected simulation space.
              if (localPrevious) {
                localPrevious.x -= dx;
                localPrevious.y -= dy;
                localPrevious.z -= dz;
              }
              if (correction.length() > NETWORK.hardCorrection)
                correction.setLength(NETWORK.hardCorrection);
            }
          } else localPrevious = { ...local };
          correctionDistance = correction.length();
          if (previous && p.level > previous) {
            hud.toast(`LEVEL ${p.level} · YOUR NEXT LIMIT!`);
            if (!hud.settings.comfort)
              effects.emit(p.x, p.y + 2, p.z, 0xffd778, 40);
          }
          hud.snapshot(p, states);
          journeyUI.snapshot(p);
        }
        setStatus(`● CONNECTED · ${Object.keys(states).length}/20`);
        if (s.orbRevision > orbRenderer.revision) requestOrbSync();
      },
    );
    room.onMessage("trailInventory", (value: TrailInventory) => {
      hud.inventory(value);
      if (value.message === "Trail equipped.") audio.effect("equip");
      if (value.message?.includes("trails unlocked")) audio.effect("level");
      journeyUI.inventory(value);
    });
    room.send("trailInventory");
    room.onMessage("pong", (sent: number) => {
      rtt = performance.now() - sent;
    });
    room.onMessage("orbState", (state: OrbState) => orbRenderer.sync(state));
    room.onMessage("orbPatch", (patch: OrbPatch) => {
      if (!orbRenderer.patch(patch)) requestOrbSync();
    });
    room.onMessage("pickup", (event: PickupEvent) => {
      const color = ORB_TYPES[event.orb.tier].color;
      if (!hud.settings.comfort)
        effects.emit(
          event.orb.x,
          event.orb.y,
          event.orb.z,
          color,
          event.orb.tier === "red" ? 36 : 20,
        );
      if (event.player === room?.sessionId) {
        hud.pickup(event);
        audio.effect(
          event.orb.tier === "gem"
            ? "gem"
            : event.orb.tier === "red"
              ? "rarePickup"
              : "pickup",
        );
        journeyUI.pickup(event);
      }
    });
    requestOrbSync();
    room.onMessage("hoop", (v: { id: number; player: string; xp: number }) => {
      avatars.get(v.player)?.wave(clock.elapsedTime);
      const h = hoops[v.id];
      if (h && !hud.settings.comfort) effects.emit(h.x, h.y, h.z, h.color, 40);
      if (v.player === room?.sessionId) {
        hud.toast(`RING CLEARED! +${v.xp} XP`);
        journeyUI.ring();
      }
    });
    room.onMessage("emote", (v: { id: string; text: string }) => {
      avatars.get(v.id)?.wave(clock.elapsedTime);
      hud.toast(`${states[v.id]?.name || "Runner"}: ${v.text}`);
    });
    room.onLeave(() => {
      connected = false;
      rewardBusy = false;
      celebration.reset();
      rewardHub.show(false);
      parkourUI.show(false);
      companions.reset();
      timedOffer.reset();
      setMediaState("MAIN_MENU");
      journeyUI.reset();
      local = localPrevious = undefined;
      buffers.clear();
      correction.set(0, 0, 0);
      lastSnapshot = 0;
      clearInput();
      pending = [];
      states = {};
      orbRenderer.clear();
      hud.clearPickups();
      hud.inventory({
        owned: [],
        equipped: DEFAULT_TRAIL,
        level: 1,
        sessionOnly: true,
      });
      setStatus("● DISCONNECTED");
      hud.panel.close();
      $("entry").style.display = "flex";
      $("error").textContent =
        "Connection ended. Rejoin to restore your saved runner.";
      button.disabled = false;
    });
  } catch (e) {
    setMediaState("MAIN_MENU");
    setStatus("● OFFLINE");
    $("error").textContent =
      `Could not join: ${e instanceof Error ? e.message : "server unavailable"}`;
    button.disabled = false;
  }
};
// Input sampling is independent of rendering. Never simulate more than the bounded
// unacknowledged window; a stalled connection cannot build up unlimited predictions.
setInterval(() => {
  if (!connected || !local || !room) return;
  const active = !document.querySelector("dialog[open]") && !inputPaused();
  if (active !== lastPresence) {
    lastPresence = active;
    room.send("presence", active);
  }
  if (!active) clearInput();
  if (pending.length >= NETWORK.maxPending) {
    // Retry the oldest unacknowledged command. Duplicates are rejected by the server;
    // a previously rejected command can now enter its drained queue. No extra prediction.
    if (!active) pending[0] = { ...pending[0], x: 0, z: 0, jump: false };
    room.send("input", pending[0]);
    return;
  }
  const x =
    Number(keys.has("d") || keys.has("arrowright")) -
    Number(keys.has("a") || keys.has("arrowleft")) +
    stickX;
  const z =
    Number(keys.has("s") || keys.has("arrowdown")) -
    Number(keys.has("w") || keys.has("arrowup")) +
    stickZ;
  const input = {
    seq: seq++,
    x: x * Math.cos(yaw) + z * Math.sin(yaw),
    z: z * Math.cos(yaw) - x * Math.sin(yaw),
    jump,
  };
  const n = Math.max(1, Math.hypot(input.x, input.z));
  input.x /= n;
  input.z /= n;
  jump = false;
  room.send("input", input);
  pending.push(input);
  localPrevious = { ...local };
  move(local, input);
  lastPrediction = performance.now();
}, DT * 1000);
setInterval(() => {
  if (connected) {
    room?.send("ping", performance.now());
    room?.send(
      "presence",
      !inputPaused() && !document.querySelector("dialog[open]"),
    );
  }
}, 1500);
const clock = new T.Clock();
let lastFrame = 0,
  lastWorldRender = -Infinity,
  shadowTimer = 1;
function frame() {
  requestAnimationFrame(frame);
  const elapsed = clock.getDelta(),
    dt = Math.min(elapsed, 0.25),
    t = clock.elapsedTime;
  lastFrame = elapsed;
  correction.multiplyScalar(Math.exp(-NETWORK.correctionRate * dt));
  const renderTime = performance.now() + serverOffset - NETWORK.interpolationMs;
  for (const [id, p] of Object.entries(states)) {
    let a = avatars.get(id);
    if (!a) {
      a = createAvatar(p);
      avatars.set(id, a);
      scene.add(a.g);
      a.g.position.set(p.x, p.y, p.z);
    }
    const isLocal = id === room?.sessionId;
    let visible =
      isLocal && local
        ? { ...local }
        : buffers.get(id)?.sample(renderTime) || p;
    if (isLocal && local && localPrevious) {
      const alpha = Math.min(
        1,
        (performance.now() - lastPrediction) / (DT * 1000),
      );
      for (const key of ["x", "y", "z"] as const)
        visible[key] = T.MathUtils.lerp(localPrevious[key], local[key], alpha);
      visible.angle =
        localPrevious.angle +
        angleDelta(localPrevious.angle, local.angle) * alpha;
      visible.x += correction.x;
      visible.y += correction.y;
      visible.z += correction.z;
    }
    a.animate(visible, t, dt, {
      distance: isLocal ? 0 : a.g.position.distanceTo(camera.position),
      low: hud.settings.quality === "low",
    });
    let trail = trails.get(id);
    if (!trail) {
      trail = {
        effect: createTrail(scene, p.equippedTrailId || DEFAULT_TRAIL),
        reset: a.resetVersion,
      };
      trails.set(id, trail);
    }
    if (trail.reset !== a.resetVersion) {
      trail.effect.clear();
      trail.reset = a.resetVersion;
    }
    trail.effect.setTrail(p.equippedTrailId || DEFAULT_TRAIL);
    const distant = camera.position.distanceToSquared(a.g.position) > 180 * 180;
    trail.effect.update(
      a.g.position,
      t,
      dt,
      {
        quality: isLocal ? hud.settings.quality : "low",
        comfort: hud.settings.comfort,
      },
      hud.settings.trailEffects &&
        (isLocal || (hud.settings.remoteTrails && !distant)),
    );
  }
  for (const [id, a] of avatars)
    if (!states[id]) {
      a.dispose();
      trails.get(id)?.effect.dispose();
      trails.delete(id);
      avatars.delete(id);
      buffers.delete(id);
    }
  const x = local?.x || 0,
    z = local?.z || 0;
  const serverTime = lastSnapshot
    ? performance.now() + serverOffset
    : Date.now();
  world.update(t, dt, x, z, serverTime);
  companions.update(connected ? local : undefined);
  timedOffer.update(
    elapsed * 1000,
    connected && !inputPaused(),
    !!local && !local.moving && local.verticalVelocity === 0,
    !!document.querySelector("dialog[open]") ||
      companions.busy ||
      rewardHub.trialActive,
  );
  petRenderer.update(
    [...avatars]
      .filter(
        ([, a]) => a.g.position.distanceToSquared(camera.position) < 120 * 120,
      )
      .map(([id, a]) => ({
        id,
        pet: states[id]?.equippedPetId,
        position: a.g.position,
        angle: a.g.rotation.y,
      })),
    t,
    dt,
    hud.settings.comfort,
  );
  effects.update(dt);
  hud.update(dt);
  const boost = Math.max(
    0,
    Math.ceil(
      ((local?.boostUntil || 0) - (performance.now() + serverOffset)) / 1000,
    ),
  );
  const xpSeconds = Math.max(
    0,
    Math.ceil(((local?.xpBoostUntil || 0) - serverTime) / 1000),
  );
  $("boostCountdown").textContent = [
    boost ? `2× SPEED · ${boost}s` : "",
    xpSeconds
      ? `2× XP ACTIVE · ${Math.floor(xpSeconds / 60)
          .toString()
          .padStart(2, "0")}:${(xpSeconds % 60).toString().padStart(2, "0")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const visibleLocal = room
    ? avatars.get(room.sessionId)?.g.position
    : undefined;
  target.set(
    visibleLocal?.x || 0,
    (visibleLocal?.y || 0) + 2,
    visibleLocal?.z || 0,
  );
  cameraYaw += angleDelta(cameraYaw, yaw) * (1 - Math.exp(-dt * 18));
  const running = local ? actualSpeed(local) : 0;
  const followDistance =
    distance + (hud.settings.comfort ? 0 : Math.min(2.5, running * 0.08));
  desired.set(
    target.x + Math.sin(cameraYaw) * followDistance,
    target.y + followDistance * 0.36,
    target.z + Math.cos(cameraYaw) * followDistance,
  );
  direction.copy(desired).sub(target);
  const length = direction.length();
  ray.set(target, direction.normalize());
  let nearest = length;
  for (const box of cameraBoxes)
    if (ray.intersectBox(box, hit))
      nearest = Math.min(nearest, hit.distanceTo(target) - 0.4);
  if (nearest < length)
    desired.copy(target).addScaledVector(direction, Math.max(2, nearest));
  camera.position.lerp(desired, 1 - Math.exp(-dt * 9));
  camera.lookAt(target);
  const fov =
    55 +
    (!hud.settings.comfort && local?.moving ? Math.min(8, running * 0.25) : 0);
  camera.fov = T.MathUtils.lerp(camera.fov, fov, 1 - Math.exp(-dt * 3));
  camera.updateProjectionMatrix();
  shadowTimer += dt;
  if (shadowTimer > 0.15) {
    renderer.shadowMap.needsUpdate = true;
    shadowTimer = 0;
  }
  orbRenderer.update(t, camera, hud.settings.comfort);
  journeyUI.navigate(local, orbRenderer.active, cameraYaw);
  // Keep the world connected behind menus; spend preview time on the visible panel.
  if (!hud.panel.open || t - lastWorldRender > 0.25) {
    renderer.render(scene, camera);
    lastWorldRender = t;
  }
  const overlay = document.getElementById("networkDiagnostics");
  if (overlay && !overlay.hidden)
    overlay.textContent = `FPS ${(1 / Math.max(lastFrame, 0.001)).toFixed(0)} · frame ${(lastFrame * 1000).toFixed(1)} ms\nRTT ${rtt.toFixed(0)} ms · snapshot age ${(performance.now() - lastSnapshot).toFixed(0)} ms\nPrediction ${predictionError.toFixed(3)} m · correction ${correction.length().toFixed(3)} m\nACK ${states[room?.sessionId || ""]?.seq ?? -1} · pending ${pending.length} · players ${Object.keys(states).length}`;
}
camera.position.set(0, 14, 25);
setStatus("● OFFLINE");
frame();
void startup();
hud.onRebirth = (expected) => {
  if (connected) room?.send("rebirth", { expected });
};
hud.onReward = (kind) => {
  if (rewardBusy) return;
  if (connected && (kind === "level" || kind === "speed" || kind === "xp")) {
    offeredReward = kind;
    rewardBusy = true;
    room?.send("rewardOffer", { kind });
  } else hud.toast("Join a world to view reward availability.");
};
document.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("button")) audio.effect("click");
});
onresize = () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
};
// Read-only diagnostics, only in Vite development builds. No mutation or reward controls.
if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
  const overlay = document.createElement("pre");
  overlay.id = "networkDiagnostics";
  overlay.hidden = true;
  document.body.append(overlay);
  Object.defineProperty(window, "riftDiagnostics", {
    get: () => ({
      media: audio.diagnostics,
      city: world.diagnostics,
      dayNight: daylight(
        lastSnapshot ? performance.now() + serverOffset : Date.now(),
      ),
      players: JSON.parse(JSON.stringify(states)),
      localId: room?.sessionId,
      predicted: local ? { ...local } : undefined,
      rtt,
      snapshotAge: performance.now() - lastSnapshot,
      predictionError,
      correctionDistance,
      hardCorrections,
      pendingInputs: pending.length,
      ack: states[room?.sessionId || ""]?.seq,
      remoteBuffers: [...buffers].map(([id, b]) => ({
        id,
        size: b.samples.length,
      })),
      orbRevision: orbRenderer.revision,
      orbs: orbRenderer.active,
      avatars: [...avatars].map(([id, a]) => ({
        id,
        x: a.g.position.x,
        y: a.g.position.y,
        z: a.g.position.z,
        animation: a.animation,
        heroStatus: a.heroStatus,
        heroClip: a.heroClip,
        trail: trails.get(id)?.effect.id,
        trailStats: trails.get(id)?.effect.stats,
      })),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      frameMs: lastFrame * 1000,
    }),
  });
}
