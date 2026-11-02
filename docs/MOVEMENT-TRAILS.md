# Movement, multiplayer and Trails update

Implemented on `feature/smooth-movement-trails`, preserving the preceding orb/world work as a separate checkpoint commit. Main is not overwritten. The existing Three.js world, avatars, Colyseus rooms, 272 shared orb slots, parkour stairs, launch pads and hoop rewards remain in place. The prompt referenced footage, but this session supplied screenshots and text, not a video; no video analysis is claimed.

## Measured cause and movement changes

Before editing, three commands sent together produced server ACK 2 after only 0.36 units of movement. Client prediction for the acknowledged commands was 1.08 units: **0.72 units of error**. The latest-input map discarded commands while acknowledging their sequence numbers. Movement also changed instantly from zero to target speed, animation phase used world time, remote avatars followed the latest packet without a timestamp buffer, and the camera followed raw predicted coordinates.

`shared/game.ts` now stores `velocityX`, `velocityZ`, and `verticalVelocity`. Both client and server use the same 40 ms fixed step, exponential acceleration/braking, controlled reverse turns, reduced air acceleration, actual-velocity facing with angle wraparound, gravity, launch pads and collision rules. `MOVEMENT` holds the tuning. In tests at level 1 and maximum speed, 90% speed arrives in **0.16 s** and full stopping takes **0.12–0.16 s**. Horizontal travel is subdivided at most every 0.2 units, allowing stairs while stopping high-speed wall tunneling. Only actual displaced distance earns running Steps.

The server queues commands and simulates each acknowledged command once. It accepts at most 12 queued inputs, rejects stale/malformed/excessive sequence jumps, and uses elapsed wall time to avoid timer drift. Catch-up is capped at 200 ms after a stall; input spam cannot create simulation time. With no command, neutral input brakes the runner and still simulates gravity. The client samples controls independently of render frames and limits predictions to 12 outstanding commands.

Reconciliation restores authoritative position and velocity, drops acknowledged inputs, and replays the rest. Small disagreements produce a decaying visual offset; errors over 4 units reset immediately and clear effects. Physics never waits for a visual correction. A fixed-step render blend smooths local presentation. Remote clients keep 32 timestamped samples, render 120 ms behind their estimate of server time, interpolate facing through wraparound, extrapolate at most 100 ms using shared collision rules, and reset on implausibly large jumps. Rejoining starts new buffers.

Animation uses traveled distance for stride phase, actual speed for intensity and lean, and blends idle/walk/jog/sprint/high-speed, turning, braking, takeoff, airborne and landing poses. The camera follows the visible avatar, damps yaw and follow position, avoids building obstructions, and gently increases distance/FOV with speed. Reduced motion suppresses those camera additions and reduces trail intensity. Development-only F3 diagnostics show frame/FPS, RTT, time since the latest received snapshot, prediction/correction distance, server ACK, pending input count and player count. The read-only diagnostics object is absent in production.

## Trail data, ownership and rewards

`shared/trails.ts` contains **77 unique IDs** and the exact supplied level-1 statistics. Advanced Variants retain +6 Steps / +5 Gems. Green Soul and Yellow Soul each retain separate Advanced Variants and Rare records. Dragonfire retains +25/+15; Hyperblast retains +20/+25. Default Trail is white, free, automatically owned/equipped and neutral (+0/+0, 1×). No trail changes movement speed.

The authoritative room stores each session's owned IDs and one equipped ID. Equipment requests accept only an owned catalog ID, are rate-limited, and return confirmed inventory. The equipped ID appears in player snapshots, including for late joiners. Ownership is checked again during reward resolution. Orb generation claims remain atomic; switching equipment never replays or creates a pickup. Flat Steps bonuses apply only to eligible orb rewards. Flat Gems bonuses apply only when the base event pays Gems. XP, running distance and hoop XP are unchanged. HUD pickup amounts come from the server.

The following **new, configurable session milestone design** supplies legitimate acquisition without inventing purchase prices:

| Group | Runner level required | Level-1 Steps / Gems bonus |
|---|---:|---:|
| Starter | 1, automatic | +0 / +0 |
| Basic | 2 | +2 / +1 |
| Advanced | 5 | +6 / +3 |
| Advanced Variants | 7 | +6 / +5 |
| Rare | 10 | +10 / +5 |
| Epic | 15 | +14 / +8 |
| Unique | 25 | +20 / +10 |
| Dragonfire | 35 | +25 / +15 |
| Hyperblast | 40 | +20 / +25 |

All unlocks are free and last only for the current connection. Reconnect behavior is tested: a new session receives only Default Trail. The panel and README disclose this. Permanent purchases, authenticated identity and durable profiles are explicitly deferred. No ownership comes from localStorage. `TRAIL_UPGRADES` is an empty extension point; no official higher-level scaling, price or upgrade action is claimed.

## Rendering and interface

Each visible trail uses a bounded 72-node ribbon pool and 64-particle pool, two draw calls, fixed typed GPU buffers, distance-based emission and time-based fading. Ribbon vertices and particle storage are reused. Families include continuous color ribbons, intertwined dual streams, snowflakes, sparks, turbulent storm wisps, coins, soul ribbons, segmented lightning, gem shapes, speed streaks, warm Dragonfire and two-color Hyperblast arcs. Rainbow variants shift smoothly along the path. The default trail appears from initial movement and fades when stopped; no advanced speed threshold is required.

Effects follow the rendered avatar, clear on equipment changes/teleports/corrections, and dispose when a player leaves. Remote trails use Low emission and are hidden beyond 180 units. Settings can hide them entirely. No particle is networked and no particle adds a light. High/Low settings change density; reduced motion keeps a subdued ribbon and suppresses trail particles. Behind an open panel the world still updates and stays connected, but renders at most four times per second so the live preview can receive more rendering time.

The Trails panel provides all cards, rarity colors, search/filter, exact stats, locked/unlocked/equipped states, free milestone requirements, equip and return-to-default actions, and a live Three.js preview using the runtime effect renderer. Unique cards have rainbow borders; Special cards have distinct treatment. Selecting a card brings its detail preview into view. Preview WebGL resources are disposed when closed. Desktop and 390×844 mobile layouts are checked.

## Validation and limits

`npm test`: **26 passed**. Coverage includes response timing at low/max speeds, diagonal normalization, 180-degree facing, deterministic shared replay, wall collision/Steps, stairs/roof/launch/jump regressions, angle interpolation, stale snapshots, bounded extrapolation and teleports; every trail group's exact count/stats, duplicate IDs, neutral default and all eligible reward paths; batched input ACKs, input flooding/spoof rejection, real pickup milestone acquisition, equipment replication to late joiners, no switch duplication and session reset. Existing random layout, orb generation/respawn, pickup synchronization and hoop tests also pass.

The actual two-browser keyboard test earned level 2, equipped Red Trail through the UI and observed it on the other client. A native WebSocket relay then added **100–140 ms per direction**, with ordered jitter. It exercised running, direction changes, jumping and stopping, observed the remote airborne avatar with its active Red Trail, then checked convergence and disconnect cleanup. One completed run recorded:

| Measurement | Stable connection | Delayed connection |
|---|---:|---:|
| Samples | 83 | 36 |
| Mean RTT | 14.9 ms | 251.1 ms |
| Maximum RTT | 66.3 ms | 288.9 ms |
| Maximum prediction error | 0.065 units | 0.388 units |
| Maximum visual correction offset | 0.177 units | 1.241 units |
| Maximum outstanding commands | 3 | 8 |
| Hard corrections | 0 | 0 |

This controlled test does not prove behavior on every network. Unit tests separately exercise stale packets and teleport resets. The real browser effects test renders all twelve families and verifies ribbon/particle expiry with no shader errors. The desktop/mobile inventory test exercises the white trail, 77 cards, locked Special stats, live preview, hidden-by-default F3 overlay, mobile scrolling and no horizontal overflow. Screenshots are visually inspected; these are automated sessions, not human playtesting.

Rendering remains a limitation: this environment uses Chromium/SwiftShader software rendering. The two-browser sample averaged 377 ms/frame during collection and 334 ms/frame during delayed-network movement. The earlier orb-only report measured about 254 ms/frame under a different viewport/load, so these are **not a controlled FPS improvement comparison**. Hardware desktop/mobile FPS, 20-player load, touch-device feel and human perception of movement remain unverified. Low graphics and pooling are implemented, but a real-device performance target is not claimed.

TypeScript and the production Vite build pass. The existing bundle-size warning remains at approximately 685 kB raw / 191 kB gzip. The browser client and Node backend must be deployed together; a static ZIP alone does not host multiplayer. See README for local startup and deployment.

The final production-browser smoke check also passed: real connection/movement/Steps, absence of development diagnostics, all 77 trail cards, automatic scrolling to a selected Special preview, locked equip state, touch settings, and separate joystick/jump/XP regions. The desktop/mobile development check reported no JavaScript or console errors after the missing favicon request was fixed.
