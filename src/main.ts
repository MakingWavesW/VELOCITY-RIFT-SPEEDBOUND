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
import "./style.css";

const hud = createHud();
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
const world = createWorld(scene),
  effects = createEffects(scene);
function applySettings() {
  world.setNight(hud.settings.night);
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, hud.settings.quality === "low" ? 0.85 : 1.5),
  );
  renderer.shadowMap.enabled = hud.settings.quality !== "low";
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
let predictionError = 0,
  correctionDistance = 0,
  hardCorrections = 0,
  rtt = 0;
let lastOrbSync = 0;
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
  if (hud.panel.open || !connected) return;
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
  $("error").textContent = "Finding your world…";
  try {
    const endpoint =
      (import.meta as unknown as { env: Record<string, string> }).env
        .VITE_SERVER_URL ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
    room = await new Client(endpoint).joinOrCreate("plaza", {
      name: ($("name") as HTMLInputElement).value,
    });
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
        }
        setStatus(`● CONNECTED · ${Object.keys(states).length}/20`);
        if (s.orbRevision > orbRenderer.revision) requestOrbSync();
      },
    );
    room.onMessage("trailInventory", (value: TrailInventory) =>
      hud.inventory(value),
    );
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
      if (event.player === room?.sessionId) hud.pickup(event);
    });
    requestOrbSync();
    room.onMessage("hoop", (v: { id: number; player: string; xp: number }) => {
      avatars.get(v.player)?.wave(clock.elapsedTime);
      const h = hoops[v.id];
      if (h && !hud.settings.comfort) effects.emit(h.x, h.y, h.z, h.color, 40);
      if (v.player === room?.sessionId) hud.toast(`RING CLEARED! +${v.xp} XP`);
    });
    room.onMessage("emote", (v: { id: string; text: string }) => {
      avatars.get(v.id)?.wave(clock.elapsedTime);
      hud.toast(`${states[v.id]?.name || "Runner"}: ${v.text}`);
    });
    room.onLeave(() => {
      connected = false;
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
      $("error").textContent = "Connection ended. Rejoin starts a new session.";
      button.disabled = false;
    });
  } catch (e) {
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
  if (hud.panel.open || document.hidden) clearInput();
  if (pending.length >= NETWORK.maxPending) return;
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
  if (connected) room?.send("ping", performance.now());
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
    a.animate(visible, t, dt);
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
      isLocal || (hud.settings.remoteTrails && !distant),
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
  world.update(t, dt, x, z);
  effects.update(dt);
  hud.update(dt);
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
        trail: trails.get(id)?.effect.id,
        trailStats: trails.get(id)?.effect.stats,
      })),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      frameMs: lastFrame * 1000,
    }),
  });
}
