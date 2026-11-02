import { createOrbRenderer } from "./world/orbs";
import {
  type OrbState,
  type OrbPatch,
  type PickupEvent,
  ORB_TYPES,
} from "../shared/orbs";
import * as T from "three";
import { Client, type Room } from "colyseus.js";
import { DT, move, speed, type Player, type Input } from "../shared/game";
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
const avatars = new Map<string, ReturnType<typeof createAvatar>>();
let states: Record<string, Player> = {},
  local: Player | undefined,
  room: Room | undefined,
  seq = 0,
  pending: Input[] = [],
  connected = false;
let lastOrbSync = 0;
function requestOrbSync() {
  if (room && performance.now() - lastOrbSync > 1000) {
    lastOrbSync = performance.now();
    room.send("orbSync");
  }
}
const keys = new Set<string>();
let yaw = 0,
  distance = 22,
  drag = false,
  jump = false,
  acc = 0,
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
  acc = 0;
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
    acc = 0;
    states = {};
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
        states = s.players;
        const p = states[room!.sessionId];
        if (p) {
          const previous = local?.level;
          pending = pending.filter((i) => i.seq > p.seq);
          local = { ...p };
          for (const i of pending) move(local, i);
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
      let lastOrbSync = 0;
      function requestOrbSync() {
        if (room && performance.now() - lastOrbSync > 1000) {
          lastOrbSync = performance.now();
          room.send("orbSync");
        }
      }
      clearInput();
      pending = [];
      states = {};
      orbRenderer.clear();
      hud.clearPickups();
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
const clock = new T.Clock();
let trailTimer = 0,
  lastFrame = 0,
  shadowTimer = 1;
function frame() {
  requestAnimationFrame(frame);
  const elapsed = clock.getDelta(),
    dt = Math.min(elapsed, 0.1),
    t = clock.elapsedTime;
  lastFrame = elapsed;
  if (connected && local) acc += dt;
  else acc = 0;
  if (hud.panel.open || document.hidden) clearInput();
  while (acc >= DT && connected && local && room) {
    acc -= DT;
    const x =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft")) +
        stickX,
      z =
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
    if (pending.length > 100) pending.shift();
    move(local, input);
  }
  for (const [id, p] of Object.entries(states)) {
    let a = avatars.get(id);
    if (!a) {
      a = createAvatar(p);
      avatars.set(id, a);
      scene.add(a.g);
      a.g.position.set(p.x, p.y, p.z);
    }
    a.animate(
      id === room?.sessionId && local ? local : p,
      t,
      dt,
      id === room?.sessionId,
    );
  }
  for (const [id, a] of avatars)
    if (!states[id]) {
      a.dispose();
      avatars.delete(id);
    }
  const x = local?.x || 0,
    z = local?.z || 0;
  world.update(t, dt, x, z);
  effects.update(dt);
  hud.update(dt);
  if (local?.moving && !hud.settings.comfort && speed(local) > 12) {
    trailTimer += dt;
    if (trailTimer > 0.08) {
      effects.emit(x, local.y + 0.2, z, 0xc6f3fc, 2);
      trailTimer = 0;
    }
  }
  target.set(x, (local?.y || 0) + 2, z);
  desired.set(
    target.x + Math.sin(yaw) * distance,
    target.y + distance * 0.36,
    target.z + Math.cos(yaw) * distance,
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
    (!hud.settings.comfort && local?.moving
      ? Math.min(8, (speed(local) - 9) * 0.3)
      : 0);
  camera.fov = T.MathUtils.lerp(camera.fov, fov, dt * 3);
  camera.updateProjectionMatrix();
  shadowTimer += dt;
  if (shadowTimer > 0.15) {
    renderer.shadowMap.needsUpdate = true;
    shadowTimer = 0;
  }
  orbRenderer.update(t, camera, hud.settings.comfort);
  renderer.render(scene, camera);
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
if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV)
  Object.defineProperty(window, "riftDiagnostics", {
    get: () => ({
      players: JSON.parse(JSON.stringify(states)),
      localId: room?.sessionId,
      orbRevision: orbRenderer.revision,
      orbs: orbRenderer.active,
      avatars: [...avatars].map(([id, a]) => ({
        id,
        x: a.g.position.x,
        y: a.g.position.y,
        z: a.g.position.z,
      })),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      frameMs: lastFrame * 1000,
    }),
  });
