# Stage 3 — GLB Pets, directed launch ramps, animated hoops and Skybound routes

Base: `feature/glb-main-city-stage2` commit `400a4c6`.
Working branch: `feature/glb-pets-ramps-stage3`. No changes to `main`.

## Implemented

- `src/world/pets.ts`: the existing 12 stable Pet species are mapped to 11 available Kenney GLB models (Ember Owl and Solar Griffin use a parrot model with different species/rarity effects). Rendering uses the Stage 2 GLTF cache, skeleton-safe cloning, normalized proportions, exponential follower smoothing, short-range bob/turn, teleport recovery, rarity aura and orbit ring on Epic/Legendary. Server equipment, Crystal odds, multipliers and saves are unchanged. Existing procedural Pets remain the fallback for missing/failed/unloaded models.
- `assets/runtime-models.json`: stages only the selected 11 Pet files and one Kenney slope GLB in addition to Stage 2's 66 runtime models. The original 656-model library stays outside the production build. Stage 2's asset-staging and verification scripts remain the source of truth.
- `shared/game.ts`, `shared/world.ts`: ramps use a forward-entry trigger and authoritative ballistic launch aimed at a real hoop, with gravity, limited midflight steering and cooldowns. Solar and Azure are re-positioned for readable approaches, original Speedway vertical pad preserved, Violet added on the reachable rooftop bridge. Hoop detection uses swept plane crossings and remains server-authoritative; no teleporting or client-authorized launch/reward messages.
- `src/world/environment.ts`: inclined ramps with GLB slope cladding and procedural neon fallback; animated additive ring highlights, rotating accents and lightweight Skybound start/checkpoint markers.
- `shared/parkour.ts`, `server/index.ts`, `server/profiles.ts`: three courses use real server positions, existing bridges/rooftops and for Sunburst an actual hoop crossing. Only course starts/cancellations are client messages. Server ticks determine ordered checkpoint passage, elapsed time, session expiration, personal best and optional cooldown-protected Gem grants. Bests and reward cooldowns persist in the existing guest profile, with transactional once-only grants.
- `src/ui/parkour.ts`, `src/main.ts`, `src/style.css`: a responsive Skybound course selector with a compact active-course HUD. Buttons and markers point to each course's real starting coordinates.
- `tests/world.test.ts`, `tests/stage3.test.ts`: directional Solar/Azure/Violet launch trajectory regression and course/Pet definition checks. Existing multiplayer and production browser suites are retained.
- `.github/workflows/stage3-validation.yml`: installs on Node 24, builds and verifies staged GLBs, runs the multiplayer server and test suite.

## Intentional limits

- Hero, existing five-second Trails, Main City geometry, movements outside launch zones, Pet/Crystal economy, V5 rewards, permanent saves, intro and Playgama advertising remain unchanged.
- A giant new Skybound mega-race with a separately ranked multiplayer leaderboard is **not** added: Stage 3 has three optional, server-validated timed courses but no fake opponents.
- The Parkour UI currently displays the authored route text and elapsed presentation timer; no live world-map breadcrumb/navigation is included.
- Pet inventory GLB turntable previews are not added; equipped in-world Pets use real GLBs. The procedural fallback stays active while a requested GLB loads.
- The GLB ramp cladding is purely visual. The actual launch/collision rules live in shared code.
- Full production browser validation and physical-device benchmarks must be performed before merging. Stage 2's baseline software rendering became slower despite fewer draw calls, so hardware FPS claims would be unjustified.

## Validation to run

```bash
npm ci
npm run build
npm run server                 # another terminal
npm test
node tests/multiplayer-browser.mjs
node tests/hero-browser.mjs
node tests/city2-browser.mjs
npx tsx tests/v5-browser.mjs
```

A repository workflow was added to check builds and network tests on this branch. At time of authoring, GitHub Actions executions were queued, not completed: this is **not a claim that Stage 3 tests passed**.

A separate numeric-only flight calculation using gravity 26 and dt 0.04 gave Solar/Azure/Violet ring crossing vertical offsets within ~0.5 world units of their centers. It excludes terrain/collision and is **not a real gameplay pass**. Real multiplayer ramp tests and mobile QA remain required.

## Next review actions

1. Inspect GitHub Actions result and fix any TypeScript/build/test errors.
2. Use two browsers to confirm Pet visuals and ramp launches with actual player input.
3. Test Crystal ownership persistence, garden/skyline checkpoint reachability, reduced-motion and mobile layouts.
4. Profile GLB Pet and ramp VFX cost on real hardware.
5. Merge only after review. Keep the Stage 2 release branch intact.
