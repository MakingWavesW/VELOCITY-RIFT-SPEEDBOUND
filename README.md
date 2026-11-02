# VELOCITY RIFT: SPEEDBOUND
An original multiplayer speed-game foundation by Vyrnora Studios, now with an expanded stylized island and redesigned interface.

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

## Multiplayer and progression
The existing Colyseus room, 25 Hz authoritative movement, sequenced inputs, prediction/reconciliation, remote interpolation, level thresholds and speed formula remain intact. Spawn positions and tier rewards intentionally replace the old fixed 72-orb/route layout. Building collisions, launch pads and server-validated hoops remain functional. Orb changes use revisioned delta packets; a rate-limited full-state sync handles initial entry and revision gaps.

Progress is **session-only** and resets on disconnect/rejoin. Only visual preferences use localStorage. Deploy matching client and server versions: the new orb protocol is incompatible with an old client/server pairing.

## Validation
With the server running:

```sh
npm test
npm run build
```
The 17 tests cover tier scaling, rarity statistics, 24 seeded world layouts, valid separated spawns, single-use claims, relocated respawns, same-tick race conditions, two-client synchronization, spoof rejection, movement, jumps, hoops and the climbable roof route.

With both server and Vite running:

```sh
node tests/orb-browser.mjs
```
This uses `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to your installed Chromium executable on other systems. It tests two isolated browser contexts, identical random layouts, real keyboard-driven pickup, exact colored HUD feedback, shared disappearance, relocated respawn, night mode, and mobile joystick/layout. Screenshots and measurements go to `artifacts/orbs/`. The earlier `tests/visual.mjs` remains available for broader visual smoke testing. Tests should run against an otherwise idle development world; do not edit source during browser tests because Vite reloads the page.

See [the orb-system report](docs/ORB-SYSTEM.md) for evidence and limitations. Automated sessions are test clients, not human playtest evidence. Software rendering and mobile emulation do not establish real-device FPS targets.

## Deployment
Client and backend deploy separately. `npm run build` produces the static browser client in `dist/`; it does not embed the Node server. Set `VITE_SERVER_URL=wss://your-backend.example` in `.env` **before** building. Serve the client over HTTPS and run `npm ci` followed by `npm run server` on a persistent Node host. `PORT` defaults to 2567; `/health` is the readiness route. Configure TLS, WebSocket upgrades and permitted origins at your reverse proxy. The TypeScript backend runner is a development dependency, so do not use `npm ci --omit=dev` with these commands. Hosting and bandwidth incur costs.

## Still unfinished
Persistent PostgreSQL profiles, authenticated reconnect, accounts, parties/room codes, region selection, races/global rankings, pet and trail inventories, rebirth, shops, quests, additional dimensions, audio, platform SDKs, production hardening and 20-player load testing. Buildings have solid walls; the skyline terrace and first tower roof are connected, but there is no island-wide rooftop network. Small decorative trees, lamps and benches do not block movement. No claim of Playgama certification, YouTube Playables compatibility, real-phone performance, or production readiness is made.

## Source layout
- `shared/world.ts`: districts, buildings/solids, ramps, hoops, bounds and crossing geometry.
- `shared/game.ts`: existing progression and deterministic movement used by client/server.
- `shared/orbs.ts`, `shared/orbRoutes.ts`: tier balance, reward formulas, protocol types, route quotas, weighting and spawn validation.
- `server/orbManager.ts`: authoritative lifecycle, random location selection, generation IDs and swept pickup geometry.
- `src/world/orbs.ts`: three-draw instanced orb renderer.
- `server/index.ts`: room, authoritative rewards and simulation, health endpoint.
- `src/world/`: reusable procedural models, environment, instancing and pooled effects.
- `src/player/avatar.ts`: character model and locally derived animation states.
- `src/ui/hud.ts`, `src/style.css`: HUD, functional panels, preferences and responsive layout.
- `src/main.ts`: existing network flow, input, camera and rendering orchestration.

All models are original procedural geometry. Bundled font licenses are in `public/licenses/` and copied to `dist/licenses/`. Formatting: `npx prettier --write src shared server tests`.
