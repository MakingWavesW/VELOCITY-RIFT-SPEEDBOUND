# VELOCITY RIFT: SPEEDBOUND

An original multiplayer browser speed game by Vyrnora Studios. This branch extends `feature/smooth-movement-trails` with a cinematic startup, saved progression and the World 1 Main City update.

## Run locally

Use **Node.js 24+** for SQLite guest profiles:

```sh
npm ci
npm run server
```

In another terminal:

```sh
npm run dev
```

Open the Vite address in two browsers, enter names and join the shared Colyseus world. WASD/arrows move, Space jumps, drag rotates the camera, wheel zooms, M opens the map and E opens a nearby crystal. Touch controls provide movement, jump and camera input.

## Implemented

- Playgama Bridge initialization, the supplied studio cinematic with its original audio, sunset menu and official GUI artwork. Browser autoplay restrictions are handled with explicit sound/silent startup buttons.
- Original synthesized gameplay music and effects, saved volume/mute controls, platform pause handling and isolated intro/menu/game audio states.
- Smooth server-authoritative movement, athletic running animation, remote interpolation, 77 collectible trails with five-second lifetimes and live previews.
- Main City: six neighborhoods, 18 additional skyline blocks, a central road circuit, accessible rooftop paths, launch pads, XP hoops and crystal landmarks. Only World 1 is implemented.
- A configurable 12-minute day/night cycle driven by server time, with warm transitions, moonlit nights, emissive windows and stars. Settings allow a personal override.
- **96 shared randomized orb slots**, sampled across valid ground, grass, roads and reachable roof areas. Collected orbs relocate within **1–3 seconds**. A population recovery rule keeps the world supplied after burst collection.
- **12 original pets and 3 crystals** costing **9 / 60 / 180 earned Gems**. Exact probabilities, owned inventory, equip/unequip, visible multiplayer followers and bounded Steps/Gems bonuses.
- Saved guest progression, rebirths, Gems, pets and trail ownership. Guest access is tied to a private device token; clearing browser data loses access. SQLite requires a durable disk and one server process.
- Optional, dismissible offers after each minute of active gameplay, deferred during movement, dialogs and other busy states. No ads autoplay. Production rewarded claims stay disabled until trusted Playgama server verification is available. Supported main-menu banners have an independent SDK path.

Crystal purchases and future verified ad rewards use transaction IDs and atomic database writes to prevent duplicate grants. Costs, odds, eligibility and awards are server-controlled.

## Orb progression and trails

| Tier | Base Level 1 Steps / XP | Base Level 10 Steps / XP |
| --- | --- | --- |
| Blue | 2 / 2 | 10 / 10 |
| Purple | 5 / 5 | 25 / 25 |
| Red | 10 / 10 | 50 / 50 |
| Gold | 10 / 15, plus 3 Gems | unchanged |

Energy orb rewards grow linearly with level, capped at 20× base. Trail bonuses apply once to eligible pickup Steps/Gems, then rebirth and pet multipliers apply. Pets never create Gems on non-Gem pickups. The HUD legend and pickup feedback reflect the final reward calculation. Streaks are visual only.

The Default Trail is free with neutral stats. Trail groups unlock at levels 2, 5, 7, 10, 15, 25, 35 and 40; unlocked ownership survives reconnects and rebirths. Original supplied trail bonus statistics remain unchanged. Rebirth eligibility starts at Level 50, increases by 25 per rebirth and gives +25% Steps/XP per rebirth while retaining Gems, pets and unlocked trails.

## Validation

With the backend running:

```sh
npm test
npm run build
```

With backend and Vite running, run browser scripts sequentially:

```sh
node tests/cinematic-browser.mjs
node --import tsx tests/city-browser.mjs
node tests/engagement-browser.mjs after
node tests/multiplayer-browser.mjs
node tests/trail-effects-browser.mjs
node tests/orb-browser.mjs
```

Scripts use `/usr/bin/chromium` and save screenshots/measurements under ignored `artifacts/`. The city script seeds a separate local test guest through SQLite; it exposes no production cheat endpoint. Keep the development world idle and do not edit source during browser tests. Software rendering and mobile emulation do not establish real-device FPS or human enjoyment.

For a production smoke test, run `npx vite preview --host 0.0.0.0`, then `node tests/production.mjs`, with the backend running.

## Deployment

`npm run build` produces the static client in `dist/`. Deploy the Node backend separately. Set `VITE_SERVER_URL=wss://your-backend.example` before building. Serve over HTTPS; configure TLS, WebSocket upgrades and allowed origins at the reverse proxy. The backend uses `PORT` (default 2567), `/health`, and `RIFT_PROFILE_DB` (default `.data/profiles.sqlite`). Mount the database directory on durable storage. The `tsx` runner is a development dependency, so the documented server command requires a full `npm ci` install.

Room capacity is configured at 20; that is not a measured 20-player load claim. Account recovery, multi-process persistence, competitive races/rankings, later worlds, production ad verification and real-device/load validation remain outstanding. Journey challenges are session-only and award no extra currency.

## Implementation reports

- [Main City systems, engagement assessment and validation](docs/MAIN-CITY.md)
- [Cinematic integration and exact Playgama activation requirements](docs/CINEMATIC-INTEGRATION.md)
- [Earlier movement/trails report](docs/MOVEMENT-TRAILS.md) and [orb report](docs/ORB-SYSTEM.md) describe their original milestones; the two reports above supersede old session-only saving and orb population details.

Core files: `shared/world.ts`, `shared/orbRoutes.ts`, `shared/pets.ts`, `shared/pickupReward.ts`, `shared/dayNight.ts`; `server/index.ts`, `server/profiles.ts`, `server/rewards.ts`, `server/rewardVerifier.ts`; `src/media/`, `src/platform/`, `src/ui/`, `src/world/`, `src/player/avatar.ts` and `src/main.ts`.

All companion/world models are original procedural geometry. Supplied media provenance and unavailable assets are documented in the cinematic report. Font licenses are bundled in `public/licenses/`.
