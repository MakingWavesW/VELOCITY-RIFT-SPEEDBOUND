# Orb system, routes and core-loop update

## Architecture and balance
The existing Three.js client and Colyseus room are retained. The fixed client/server orb array and shared ten-second cooldown list are replaced by a room-owned `OrbManager`. The world remains 880 × 880 and the original movement, level threshold and speed formulas remain intact. No persistent profile or save format is introduced.

`shared/orbs.ts` defines Blue/Purple/Red/Gold visuals, Steps/XP/Gems, respawn ranges, pickup radius, spacing, level scaling, future server multiplier inputs, and packet types. Main-tier rewards use:

```
round(baseReward × min(20, 1 + (floor(level) − 1) × 4/9) × serverMultipliers)
```

Level 1: Blue 2 Steps/2 XP, Purple 5/5, Red 10/10. Level 10: 10/10, 25/25, 50/50. Gold retains 10 Steps, 15 XP and 3 Gems. Level is sampled before applying that pickup's XP. Future multipliers default to one and cannot be supplied through client messages. Streaks have no economic multiplier.

## Spawn lifecycle and synchronization
Nine route budgets total 272 active slots. Exact positions are sampled on the server from route candidates with jitter; colors are rolled using district weights. Base standard-tier weighting is 65/25/10; additional Gold weight is 4. First Steps and speedway routes favor Blue; Amethyst Grove favors Purple; Scarlet Skyline and Ember Hideaway favor Red. Regional weights intentionally differ from the global baseline.

Validation excludes solid buildings, unsupported elevations, ponds/ocean, world boundaries, central monument/planters/huts, and an eight-unit spawn safety radius. Orbs stay at least 4.5 units apart in 3D. Busy slots retry later if no valid point is available rather than violating separation. Candidate routes include open roads, loops, garden pockets, a climbable terrace and an actual tower roof.

Only server simulation can collect an orb. Swept pickup geometry avoids missed crossings at speed and rejects wrong-height pickups. Claims consume `(slot ID, generation)` once. Cooldowns are randomized per collected tier: Blue 6–10s, Purple/Gold 10–15s, Red 14–22s. Respawning rerolls position and tier within the same route, moves at least three horizontal units from the previous location, and increments generation. An orb collected immediately on respawn is excluded from the outgoing spawn delta.

`orbState` supplies an initial/recovery snapshot. `orbPatch` carries changed spawns/removals with a revision. Regular movement snapshots carry only `orbRevision`, not the full orb layout. The client requests a rate-limited resync if revisions skip. The server also rate-limits full-state requests. Colyseus rejects and disconnects clients sending unknown reward/spawn message types; no such message grants currency.

## Rendering, UI and world routes
Two fixed-capacity InstancedMeshes provide rounded shells and brighter inner cores; one point batch provides soft halos. These three draws cover all tiers, including Gems. Positions/colors change only from received server state. Hover/pulse effects are local visual motion, and reduced-motion preferences suppress them. A fixed particle pool handles confirmed pickups.

Popup tier, Steps, XP and Gems come from the server's pickup event. The HUD shows the current-level reward preview and a short visual streak. Up to four popup elements are retained; expired elements are removed. The future audio hook is `rift:orb-pickup`; no fabricated audio system, rebirth, pet multiplier, shop or race feature is presented.

New route signs and flat waymarkers guide players toward Blueway Run, Violet Avenue, Amethyst Grove, Scarlet Skyline, Ember Hideaway and coastal routes. The skyline terrace extends along an elevated strip; additional shared-geometry stairs connect it to the first tower roof. Roof render surfaces are aligned with authoritative support height. Small scenery markers are not collectibles.

## Automated evidence
The complete suite has 17 tests. The seeded test samples 24 independent layouts, each with 272 active orbs: 4,063 Blue, 1,596 Purple, 629 Red and 240 Gold across 6,528 orbs. Excluding Gold, this is approximately 64.6% / 25.4% / 10.0%. A separate 50,000-roll test checks the baseline 65/25/10 selector within one percentage point.

Tests check exact level-1/10 rewards, gradual capped growth, server-only multiplier validation, layout variability, ground/bounds/pond/solid constraints, minimum separation, roof availability, duplicate claims, generation replay rejection, delayed relocation, same-tick spawn/collection, wrong-height/distant pickup rejection, and movement/hoop/roof-route regressions.

The network test uses two actual Colyseus clients: identical initial layout, keyboard-equivalent movement to a random Blue orb, one exact reward, disappearance on both clients, matching relocated respawn, jump synchronization and rejection of spoofed reward/spawn messages. It waits for the server's stop acknowledgement before testing rejected movement, so ordinary in-flight movement is not mistaken for an exploit.

Browser evidence and software-rendering measurements are saved by `tests/orb-browser.mjs` under `artifacts/orbs/`. These are automated test sessions, not human population. Hardware FPS targets, 20-player load, high-latency behavior, persistence and production hosting remain unverified. The original game's session-only progression remains a limitation.

## Captured browser result and performance limits
The completed browser run joined two actual clients to a 272-orb layout (168 Blue, 70 Purple, 29 Red, 5 Gold). A keyboard-driven Blue pickup at level 1 produced the exact visible text `+2 Steps  +2 XP` with border color `rgb(16, 220, 255)`. Both clients observed its removal and matching generation-2 respawn at a new location. Night rendering, mobile joystick movement, reward legend placement, and the joystick/XP separation check passed. No JavaScript page errors were reported. Raw evidence is `artifacts/orbs/results.json`; captures include day, night, pickup and mobile images.

The 20-frame low-quality sample in headless Chromium/SwiftShader averaged approximately **254 ms/frame (~3.9 FPS)**, with 238 scene draw calls and 259,590 submitted triangles. This is slow software rendering, not evidence of meeting desktop/mobile FPS targets. Three orb draw calls remain constant with population, but the rounded geometry has a triangle cost; hardware profiling and further optimization remain release work. No 20-player performance claim is made.

The production build passed TypeScript and Vite. Vite's existing large-chunk warning remains: the main bundle is approximately 663 kB raw / 182 kB gzip. Client and server must be deployed together for the new revisioned orb protocol.

The final production smoke test also passed against the built static client: actual server connection, movement/Steps, touch settings, non-overlapping joystick/jump/XP layout, and no JavaScript page errors. Its movement check waits for observed progress after focusing the game canvas rather than assuming a fixed two-second delay is sufficient in software rendering. Formatting and `git diff --check` passed.
