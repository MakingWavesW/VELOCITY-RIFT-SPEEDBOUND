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

## Multiplayer and gameplay
The existing Colyseus protocol, 25 Hz authoritative movement, sequenced input, prediction/reconciliation, remote interpolation, XP formulas and original 72 collectibles are preserved. Additional collectible routes lead into the larger island. The server controls rewards, shared 10-second orb cooldowns, collisions, launch pads and hoop crossings. Blocked movement no longer earns Steps. Short jump inputs are retained until the next server tick, including when a later packet arrives first within that tick.

Progress is **session-only** and resets on disconnect/rejoin. No save data migration is needed because the supplied project had no persistent profiles. Only visual preferences use localStorage.

## Validation
With the server running:

```sh
npm test
npm run build
```
The 10 tests cover malformed inputs; two actual WebSocket clients; movement/jump/reward synchronization; currency spoof rejection; coalesced jump packets; a full launch-to-hoop route; shared bounds/collision; collectible accessibility; staircase/landing behavior; and hoop crossing edge cases.

With both server and Vite running:

```sh
node tests/visual.mjs
```
This uses `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to your installed Chromium executable on other systems. It tests two isolated browser contexts, rendered remote movement/jumping, menus, night mode, leaving, and emulated mobile joystick input. Actual screenshots and measurement output go to `artifacts/`. Tests should run against an otherwise idle development world; do not edit source during browser tests because Vite reloads the page.

See [the overhaul report](docs/VISUAL-OVERHAUL.md) for evidence and limitations. Automated sessions are test clients, not human playtest evidence. Software rendering and mobile emulation do not establish real-device FPS targets.

## Deployment
Client and backend deploy separately. `npm run build` produces the static browser client in `dist/`; it does not embed the Node server. Set `VITE_SERVER_URL=wss://your-backend.example` in `.env` **before** building. Serve the client over HTTPS and run `npm ci` followed by `npm run server` on a persistent Node host. `PORT` defaults to 2567; `/health` is the readiness route. Configure TLS, WebSocket upgrades and permitted origins at your reverse proxy. The TypeScript backend runner is a development dependency, so do not use `npm ci --omit=dev` with these commands. Hosting and bandwidth incur costs.

## Still unfinished
Persistent PostgreSQL profiles, authenticated reconnect, accounts, parties/room codes, region selection, races/global rankings, pet and trail inventories, rebirth, shops, quests, additional dimensions, audio, platform SDKs, production hardening and 20-player load testing. Buildings have solid walls; the dedicated skyline terrace is climbable, but there is no complete rooftop bridge network. Small decorative trees, lamps and benches do not block movement. No claim of Playgama certification, YouTube Playables compatibility, real-phone performance, or production readiness is made.

## Source layout
- `shared/world.ts`: districts, buildings/solids, ramps, hoops, bounds and crossing geometry.
- `shared/game.ts`: existing progression and deterministic movement used by client/server.
- `server/index.ts`: room, authoritative rewards and simulation, health endpoint.
- `src/world/`: reusable procedural models, environment, instancing and pooled effects.
- `src/player/avatar.ts`: character model and locally derived animation states.
- `src/ui/hud.ts`, `src/style.css`: HUD, functional panels, preferences and responsive layout.
- `src/main.ts`: existing network flow, input, camera and rendering orchestration.

All models are original procedural geometry. Bundled font licenses are in `public/licenses/` and copied to `dist/licenses/`. Formatting: `npx prettier --write src shared server tests`.
