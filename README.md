# VELOCITY RIFT: SPEEDBOUND
An original multiplayer speed game by Vyrnora Studios, with an expanded island, smooth authoritative movement, and 77 collectible trails.

## Run on Windows, macOS or Linux
Install Node.js 22.12+ (validated with Node 24). Open a terminal in this directory:

```sh
npm ci
npm run server
```
Leave it running. Open another terminal in the same directory:

```sh
npm run dev
```
Open the Vite address in two browsers, enter names, and join. Clients connect to a real Colyseus room. Capacity is configured at 20, with another room created when full; this is not a measured 20-player performance claim.

Desktop: WASD/arrows move, Space jumps, drag rotates the camera, wheel zooms, M opens the map, Escape closes menus. Touch: virtual joystick, jump button, and swipe camera. Hello sends a rate-limited preset message and character wave.

## Visual overhaul
- An 880 × 880 island with Sunburst Plaza, Rainbow Downtown, Speedway Boulevard, Crystal Gardens, Skyline Challenge, and Coastal Adventure. The supplied ZIP actually contained the earlier 120 × 120 map, so this expansion was implemented here.
- Original geometric buildings with beveled silhouettes, roof trim, doors and emissive windows; six vegetation styles, benches, lamps, ponds, crystals, coastal piers, clouds and offshore scenery.
- A central animated rift monument, connected roads, district signs, an accessible skyline staircase and terrace.
- Four functional colored hoops and three launch pads. Passing through a hoop grants 20 server-validated XP with a 20-second personal cooldown. Pad and hoop coordinates are shared with the server. Decorative crystals, huts and the central monument have no purchase or travel actions.
- Original humanoids with faces, shoes, backpacks, shoulder/hip animation, airborne poses, landing compression, idle breathing, and greeting/hoop celebrations.
- Instanced buildings/props, instanced orbs and clouds, pooled pickup particles, shared materials, selective shadows, pixel-ratio limits, and Low/High graphics settings.
- Locally bundled Lilita One and Nunito fonts. Responsive HUD with animated counters, XP, live roster, live-position island map, settings and help. No fictional race announcements or unavailable shop/pet buttons.
- Personal day/night atmosphere, graphics quality, camera sensitivity and reduced-motion settings persist locally. They do not change server time or progression. Audio is not implemented, so there are no inactive audio sliders.

## Orb-driven gameplay
The world has **272 shared random orb slots across nine named routes**. The server chooses every location and tier, validates swept-distance pickups, grants rewards exactly once, and respawns orbs at a different valid position on their route. Clients render only received state. Blue is common, Purple is less common, and Red is rare; Gems remain available.

| Tier | Level 1 Steps / XP | Level 10 Steps / XP | Respawn delay |
|---|---|---|---|
| Blue | 2 / 2 | 10 / 10 | 6–10 seconds |
| Purple | 5 / 5 | 25 / 25 | 10–15 seconds |
| Red | 10 / 10 | 50 / 50 | 14–22 seconds |
| Gold Gem | 10 / 15, plus 3 Gems | unchanged | 10–15 seconds |

The shared reward function grows linearly with level and caps the level multiplier at 20. Server-only multiplier inputs are reserved for future rebirths/worlds/upgrades; no unfinished system is enabled. Route-specific rarity weights make First Steps beginner-friendly, Amethyst Grove Purple-rich, and Scarlet Skyline/Ember Hideaway Red-rich. The Skyline route now connects its terrace to a real tower roof. Route signs and flat color markers guide exploration; markers are not collectible orbs.

The HUD displays exact server-confirmed amounts, tier-colored floating feedback, current-level reward previews, and a visual-only 4.5-second pickup streak. A `rift:orb-pickup` browser event is available for a future audio adapter; no sound engine is claimed. Orbs have smooth colored shells, bright inner cores, pulsing halos, hover motion and confirmed-pickup particles.

## Movement and Trails
Shared fixed-step physics now stores horizontal and vertical velocity, accelerates to 90% speed in 0.16 seconds, brakes in 0.12–0.16 seconds, and sweeps collisions in 0.2-unit substeps. Facing follows actual travel; animation cadence follows distance. Local correction smoothing, a timestamped 120 ms remote buffer, bounded extrapolation, and a camera following the visible avatar coordinate presentation. Press **F3 in development** for network/frame diagnostics.

Every runner owns and equips the free **Default Trail** automatically: soft white, +0 Steps, +0 Gems, neutral 1×. Open **Trails** for all 77 exact level-1 records, rarity filters, search, live 3D previews, ownership, and server-confirmed equipping. Duplicate Green Soul / Yellow Soul variants have distinct IDs and tier labels. Only one main trail applies. Graphics settings can hide remote trails and reduce motion/particles.

Session level milestones unlock each group for free: Basic 2, Advanced 5, Advanced Variants 7, Rare 10, Epic 15, Unique 25, Dragonfire 35, Hyperblast 40. These are explicit design choices; the supplied bonus statistics are unchanged. No purchase prices or higher-level upgrade scaling have been invented.

The server adds the equipped trail's Steps bonus once to an eligible orb pickup. It adds the Gems bonus only when the base pickup awards Gems. XP and running-distance rewards receive no trail bonus. For example, Basic Red gives a level-1 Blue orb 4 Steps / 2 XP / 0 Gems, and a Gold pickup 12 Steps / 15 XP / 4 Gems. Popups display the final server award; the small orb legend shows base orb Steps.

## Multiplayer and progression
Colyseus remains authoritative at 25 Hz. Commands are queued and acknowledged after simulation, with a bounded input window and a wall-clock movement budget. Reconciliation replays unacknowledged commands using the same velocity/collision rules. Snapshot timestamps drive remote interpolation; equipment IDs are replicated, individual particles are generated locally. Orb changes retain revisioned delta packets and recovery sync.

Progress and trail ownership are **session-only** and reset on disconnect/rejoin. Only visual preferences use localStorage. Permanent purchases, authenticated profiles and durable ownership are explicitly deferred. Deploy matching client and server versions: the velocity, equipment and orb protocols require the updated pair.

## Validation
With the server running:

```sh
npm test
npm run build
```
The 26 tests cover movement response timing, high-speed collisions, deterministic replay, timestamp buffering, all trail stat exceptions, ownership checks, equipment replication, reconnect reset, input flooding, plus tier scaling, rarity statistics, 24 seeded world layouts, valid separated spawns, single-use claims, relocated respawns, same-tick race conditions, two-client synchronization, spoof rejection, movement, jumps, hoops and the climbable roof route.

With both server and Vite running:

```sh
node tests/trails-browser.mjs
node tests/multiplayer-browser.mjs
node tests/trail-effects-browser.mjs
node tests/orb-browser.mjs
```
Browser scripts use `/usr/bin/chromium`; the orb script also accepts `CHROMIUM_PATH`. Run scripts sequentially to avoid competing software-rendering loads. The trail scripts cover real keyboard movement, the default stream and stop fade, all cards, live previews, mobile layout, two-browser earning/equipping, disconnect cleanup, and a native WebSocket relay with 100–140 ms one-way latency. The relay uses local port 2568. The effect harness renders all twelve families separately. Screenshots and measurements go to `artifacts/trails/`. The existing orb regression script records evidence under `artifacts/orbs/`.

Run browser tests against an idle development world without editing source; Vite reloads interrupt tests. To smoke-test production, run `npx vite preview --host 0.0.0.0` and `node tests/production.mjs` with the backend still running.

See [the movement and trails report](docs/MOVEMENT-TRAILS.md) and [the earlier orb report](docs/ORB-SYSTEM.md) for implementation decisions and validation limits. Automated clients and mobile emulation do not establish human movement feel or real-device FPS.

## Deployment
Client and backend deploy separately. `npm run build` produces the static browser client in `dist/`; it does not embed the Node server. Set `VITE_SERVER_URL=wss://your-backend.example` in `.env` **before** building. Serve the client over HTTPS and run `npm ci` followed by `npm run server` on a persistent Node host. `PORT` defaults to 2567; `/health` is the readiness route. Configure TLS, WebSocket upgrades and permitted origins at your reverse proxy. The TypeScript backend runner is a development dependency, so do not use `npm ci --omit=dev` with these commands. Hosting and bandwidth incur costs.

## Still unfinished
Persistent PostgreSQL profiles, authenticated reconnect, accounts, parties/room codes, region selection, races/global rankings, pet inventories, permanent trail purchases/upgrades, rebirth, shops, quests, additional dimensions, audio, platform SDKs, production hardening and 20-player load testing. Buildings have solid walls; the skyline terrace and first tower roof are connected, but there is no island-wide rooftop network. Small decorative trees, lamps and benches do not block movement. No claim of Playgama certification, YouTube Playables compatibility, real-phone performance, or production readiness is made.

## Source layout
- `shared/world.ts`: districts, buildings/solids, ramps, hoops, bounds and crossing geometry.
- `shared/game.ts`: progression and shared velocity-based movement.
- `shared/trails.ts`: all 77 records, exact bonuses, session milestones and future upgrade configuration.
- `src/network/snapshots.ts`: timestamped remote interpolation and bounded extrapolation.
- `src/world/trails.ts`, `src/ui/trails.ts`: pooled ribbon/particle effects, inventory and live 3D preview.
- `shared/orbs.ts`, `shared/orbRoutes.ts`: tier balance, reward formulas, protocol types, route quotas, weighting and spawn validation.
- `server/orbManager.ts`: authoritative lifecycle, random location selection, generation IDs and swept pickup geometry.
- `src/world/orbs.ts`: three-draw instanced orb renderer.
- `server/index.ts`: room, authoritative rewards and simulation, health endpoint.
- `src/world/`: reusable procedural models, environment, instancing and pooled effects.
- `src/player/avatar.ts`: character model and locally derived animation states.
- `src/ui/hud.ts`, `src/style.css`: HUD, functional panels, preferences and responsive layout.
- `src/main.ts`: existing network flow, input, camera and rendering orchestration.

All models are original procedural geometry. Bundled font licenses are in `public/licenses/` and copied to `dist/licenses/`. Formatting: `npx prettier --write src shared server tests`.
