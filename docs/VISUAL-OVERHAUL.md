# Visual overhaul implementation report

## Baseline and scope
The supplied ZIP was compared byte-for-byte against the checkout. All 13 supplied files matched. Despite the brief referring to an existing 880-unit map and hoop challenges, the actual source had a 120-unit ground, ±57 movement bounds, 72 orbs, no building collision, and one decorative ring. The original build, two-WebSocket-client tests and browser smoke test passed after starting the backend.

This update expands that existing game; it retains the Colyseus room and message flow rather than introducing a replacement prototype. Original orb IDs/rewards and progression formulas remain intact. There was no persistent player save format to migrate.

## What changed
- Shared 880-unit island layout with six named districts, 46 solid buildings, a stepped skyline terrace, and coherent road corridors. Rendering, collision, bounds, launch pads and hoop triggers use `shared/world.ts`.
- Beveled pastel buildings with roofs, trim, entrances and luminous windows; cubic, rounded, flowering, pine and crystal-colored vegetation; crystal gardens, ponds, benches, lamps, docks, beach huts, island walls and distant islands.
- An animated central energy sculpture and original detailed runner with hair, eyes, smile, jacket, backpack and shoes. Local and remote players share procedural idle, running, airborne, landing and greeting/hoop celebration animation. No pose streaming was added.
- Four colored hoops with swept plane tests and server-verified XP; three launch pads; additional accessible orb routes. The solar route is exercised end-to-end through a real server client.
- New entry screen and responsive HUD, compact animated counters, XP bar, roster, functional island map, help and visual settings. Local font files and their licenses are bundled.
- Day/night is an explicitly personal visual setting, not a fabricated synchronized clock. No fake race timers, shop screens, players, inventory or premium currency systems were added.
- Real pointer-based mobile joystick, large jump target, desktop controls, camera obstruction shortening, reduced-motion option, and separate low/high rendering settings.
- Static props are instanced by material/geometry and spatial chunk. Orbs use two instanced draws plus one halo point batch; clouds use one instance batch. Particles use a fixed 256-slot pool. Character label resources are disposed on leave. Shadows update at a bounded rate and pixel ratio is capped.

## Gameplay fixes required by the new world
Movement reports actual displacement rather than attempted displacement, preventing Steps from accumulating against a wall. Ground heights and solid footprints support the staircase and roofs. Jump presses are latched until the next authoritative tick so a newer movement packet cannot erase a short press. Hoop checks handle exact plane hits and do not reward players standing inside the opening. Unavailable progression systems remain unavailable.

## Tests and evidence
- `npm run build`: TypeScript and Vite production build passed. Vite reports a >500 kB JavaScript chunk warning; the main bundle is approximately 655 kB raw / 179 kB gzip. This is a size warning, not a build failure.
- `npm test`: **10 passed, 0 failed, 0 skipped**. Includes malformed input, two real connections, shared rewards, spoof rejection, coalesced jump input, real launch-to-solar-hoop route, collision/bounds, all orb locations, stairs, ground landing and hoop crossing edge cases.
- `node tests/visual.mjs`: **passed**. Two isolated Chromium contexts joined the same room; the second observed the first character's rendered movement and jump. Leaving updated membership. Day/night, map, graphics settings and emulated touch movement passed with no JavaScript page errors.
- `node tests/production.mjs`: **passed** against the built static client on port 4173. Actual backend connection, movement/Steps, touch settings, and non-overlapping joystick/jump/XP layout were verified, with no JavaScript page errors.
- `artifacts/visual-results.json` contains the captured state and software rendering measurement. The named runners in screenshots are explicitly automated test sessions, not fabricated online population.
- Screenshots in `artifacts/` are actual browser captures, not generated concepts: welcome screen, daytime multiplayer, night, island map, high graphics, production desktop and production mobile.

## Performance interpretation
A 30-frame single-client low-quality sample in **headless Chromium using SwiftShader software rendering**, at a 1440 × 900 viewport, recorded approximately **299 ms/frame (3.3 FPS), 214 draw calls and 88,986 submitted triangles**. The earlier unbatched sample recorded about 338 ms/frame and 357 draw calls. Camera/player positions differed slightly, so these are indicative measurements rather than a controlled benchmark. Instancing reduces calls but submits more offscreen orb/cloud triangles.

These numbers do **not** demonstrate the requested 60 FPS desktop or 30 FPS phone targets. This cloud software renderer is slow, and hardware-accelerated desktop/mobile profiling and further optimization remain release gates. Twenty-player capacity is configured but has not been load-tested. No broad performance or production-readiness claim is made.

## Remaining limitations
- Actual mobile GPUs, Safari/Firefox, unstable networks and 20 simultaneous clients are untested.
- PostgreSQL saves/authenticated reconnect, parties, races, inventories, shops, rebirth, quests, other worlds, audio and platform integrations are still outside the implemented foundation.
- The skyline terrace is accessible, but the city does not yet have a complete interconnected rooftop course. Buildings are solid; small scenery props intentionally do not obstruct runners. Offshore scenery is outside playable bounds.
- The four ring styles share a reusable geometry family. Launch pads are low-profile energy platforms, not conventional inclined physics ramps. Pet stores and purchase buildings were not presented as live gameplay features.
- Normal movement animation scales with speed; there is no new gameplay speed-burst ability or separate race-victory state to animate. Wave and confirmed hoop-completion celebrations are implemented.
- Publication of a hosted multiplayer service is separate from building this source. Deploy the static client and persistent Node backend separately as described in README.
