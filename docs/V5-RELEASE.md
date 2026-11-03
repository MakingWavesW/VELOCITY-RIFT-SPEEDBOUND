# V5 Main City release candidate

Base: `feature/cinematic-gameplay-integration` at `ce5a27a`, including the three original GUI uploads. Work branch: `feature/v5-progression-rewards`. No later worlds or fictional multiplayer opponents were added.

## Stability

The client used to stop transmitting once its 12-command prediction window filled. A real browser reproduction blocked outgoing packets for 1.5 seconds: the old code remained at x=0 with 12 pending commands. The updated client retries its oldest unacknowledged command while full, without adding predictions or growing the queue. The same reproduction recovered to x=30.28 with two commands pending. Sequence checks reject duplicate execution. The server still consumes at most one queued command per 40ms simulation tick and maintains its wall-clock budget. Physics, wall sliding, stairs and heroic animation are preserved.

This fixes a stalled window, not arbitrary network disconnection. Long latency can still reduce responsiveness with bounded prediction; reconnect is necessary when the WebSocket closes. No hardware FPS claim is made.

## Progression

The 96-orb total and base Blue/Purple/Red rewards are unchanged. More randomized slots now follow the plaza and north/south roads (28/16/12 slots). Other neighborhoods and reachable roofs retain their slots. Starter rarity weights are Blue 62, Purple 18, Red 6, Gold 8, normalized by their total. Validity/spacing, authoritative swept pickup checks and random replacements remain intact.

The beginner path rewards five Blue orbs, Purple+Red, six orb Gems, a crystal hatch, pet equipment and a trial finish, in order. Rewards are 2/2/2/3/2/5 Gems, claimed once per saved runner. Facts come only from server simulation and successful purchases. Three daily goals rotate deterministically by UTC day: energy collection, Purple or hoops, and real distance. Rewards are 4/6/8 Gems.

Combo Rush gives one Gem for at least five pickups inside the existing streak window, at most once per 30 seconds and 20 times per UTC day. Unique orb generations prevent replayed pickups. The award and cooldown are committed atomically. This does not multiply base Steps or XP.

Plaza Dash is honestly labeled a solo time trial: start near spawn, wait three seconds, run through the north checkpoint, turn at the second gate, and return through the checkpoint to spawn. The server validates ordered proximity, uses its clock, enforces a minimum duration and three-minute timeout, and saves a personal best. Finish rewards are eight Gems with a five-minute saved cooldown. Other players remain active; there are no invented competitors.

## Daily and playtime rewards

Both systems use the existing private guest token and SQLite. One active session per profile remains enforced. Claims commit the profile and a unique grant key in one transaction; client clocks, supplied amounts and repeat messages cannot grant extra currency.

Playtime uses a persistent UTC-day track: 2/5/10/20/30 active minutes award 5/12/25/40/60 Gems. The last reward is real Gems, not an invented cosmetic. Only server-observed physical travel with valid input and a fresh foreground heartbeat counts. Idle standing, blocked running, hidden tabs and ads do not deliberately accrue time. A client can lie about visibility or automate legitimate movement; this is an activity policy, not a claim of bot detection. The 40ms fixed-step budget bounds accumulation. Track progress is saved every five seconds and on normal leave; claims save immediately. Abrupt server failure may lose up to five seconds of unclaimed progress.

At 00:00 UTC the playtime track, daily quests and combo daily cap reset. Backwards clock changes do not reopen an older day. The seven-day login calendar awards 3/5/8/12/15/20/35 Gems. Consecutive UTC days advance it, a missed day restarts Day 1, and Day 7 wraps to Day 1. Each day has a unique durable claim key. There is no ad requirement. Guest rewards do not follow users across devices, and new guest identities can start separate calendars; account identity is not implemented.

## UI and advertisements

Exact supplied originals are copied byte-for-byte to `public/media/playtime-rewards.png`, `daily-rewards.png` and `reward-xp.png`. The daily source filename is `Neon Daily Rewards Gift Banner (1).png` in the actual upload. No substitute images were generated. Existing official level/speed artwork remains in use.

Playtime and Daily buttons have gold readiness badges, a short bounce and a sparse opacity pulse. Native dialogs retain keyboard/focus behavior and gain short opening/closing transitions. Buttons have consistent hover/press states; disabled buttons do not animate as actionable controls. Reduced-motion preferences and the in-game comfort setting suppress the added motion. A scrollable navigation rail keeps the larger menu accessible on small screens.

Boost Center previews all three offers. The new XP reward doubles only orb and hoop XP for 180 seconds, after normal rebirth calculation; Steps, Gems, running-distance XP and direct +1 Level grants are unchanged. Speed and XP expiry are independent, persisted and nonstacking. Transactions, expiry, verification and duplicate protection reuse the existing server reward service.

**Production ad claims are still disabled.** No browser callback is accepted as proof. The minute-based compact invitation is suppressed entirely while the verifier is unavailable. When configured, it waits for calm gameplay, with a three-minute interval after dismissal; the full panel opens voluntarily. The supported main-menu banner path remains independent. See [CINEMATIC-INTEGRATION.md](CINEMATIC-INTEGRATION.md) for the required provider identity/transaction mapping, trusted completion API or webhook, signing/authentication, placement configuration and hosted validation.

## Validation

Unit/integration tests cover active-time eligibility, UTC calendar/reset, atomic single-use claims, reconnect persistence, ordered beginner quests, trial checkpoints, nonstacking XP and verification gating, alongside the existing movement, security, world, trail, pet and crystal regressions.

Browser fixtures are separate from real gameplay: `tests/v5-browser.mjs` seeds only a dedicated local test guest to check milestone readiness, badges, claims, calendar, Boost Center, reduced motion, small viewports and reconnect. `tests/beginner-browser.mjs` creates a fresh unseeded guest and uses keyboard steering toward visible ground orbs, with no daily/playtime claims. `tests/movement-recovery-browser.mjs` injects a bounded outgoing-message outage. Existing multiplayer tests support `RIFT_TEST_LATENCY` and `RIFT_CPU_RATE` for delayed-network/software-rendering stress.

Human enjoyment, a human ten-minute playtest, real-device FPS, production portal ad delivery and 20-player load are not established by these automated checks. SQLite still requires one server process and durable storage.

## Release checks recorded

- 53/53 unit/network integration tests pass; TypeScript and Vite production build pass.
- Exact source/public artwork SHA-256 pairs match for all three new PNGs.
- Desktop, 360×640 and 390×844 reward UI checks pass, including actual claims, readiness badges, reduced motion, all-disabled Boost Center cards and saved reconnect state.
- Two browser clients with 300–340ms one-way delay and 3× CPU throttling passed: maximum measured RTT 691ms, prediction error 0.237 units, zero hard corrections, replicated trail equipment and disconnect cleanup. Software rendering is not real mobile hardware.
- The first targeted-orb run reached nine Gems in 13.1 seconds and 41 Gems by one minute. This was too generous after concentrating the route; starter/north/south Gold weight was reduced to 8. Final pacing measurements are recorded below.

## Main changed files

`shared/engagement.ts`, `server/engagement.ts` and `server/profiles.ts` implement reward state and atomic persistence. `server/index.ts` integrates simulation facts, pause handling and claims. `src/main.ts` contains bounded movement recovery and activity signals. `shared/progression.ts`, `shared/pickupReward.ts`, `server/rewards.ts` and `server/rewardVerifier.ts` extend the XP verification boundary. `src/ui/rewardHub.ts`, `timedOffer.ts`, `motion.ts`, `companions.ts`, `hud.ts` and `src/style.css` provide the panels, badges and feedback. World/orb configuration stays in `shared/orbRoutes.ts` and `src/world/environment.ts`. New regression/browser scripts are under `tests/`.

## Final progression observations

After the Gold-weight adjustment, the unseeded guided run reached nine Gems in 31.14 seconds. At 60.02 seconds it had Level 5, 14 Gems, 46 partial XP and 843.54 Steps, then purchased and equipped a first pet through the crystal UI. There were no page errors. This script efficiently prioritizes visible nearby ground pickups, including Gold, and therefore beats the 2–3-minute first-pet goal. It is a feasibility check, not a guarantee of novice pacing. No daily/playtime grants or seeded balances were used; ordinary server Combo Rush awards can contribute.

The earlier V4 straight-line circuit reached Level 3 and zero Gems in its first minute. That route differed from the guided run, so the numbers do not establish a controlled retention or progression improvement. The V5 scripted trial completed using ordinary keyboard input and saved a 21.81-second personal best.

Guided-run frame samples ranged from 16.1 to 923.7 ms; draw calls ranged from 176 to 315. These are software-rendered scene observations, not hardware performance targets. No new dynamic lights were introduced.

The final two-client test at 100–140ms one-way delay also passed after pause handling was added (maximum RTT 284.2ms, zero hard corrections). The cinematic/audio, all-77-trails, level-popup and rebirth-eligibility browser regression passed. Final minified client JavaScript is about 730 kB (208 kB gzip); Vite retains its large-chunk advisory.

## Matching circuit and final UI smoke test

The same 60-second W/D/S/A circuit used for V4 reached Level 3, 595.24 Steps, 30 partial XP and zero Gems in V5, versus V4 Level 3, 580.78 Steps, 20 partial XP and zero Gems. Both had no page errors. This is only a small progression change for straight-line movement; targeting nearby collectibles is still necessary for reliable Gem earnings. The guided run above demonstrates that route, not guaranteed passive Gem income.

Final touch tests cover actual tap claims, saved badges, stable calendar buttons, reduced motion, 360×640 and 390×844 layouts, and menu clearance above the joystick. The calendar now updates its clock without rebuilding unchanged cards; this fixes a touch race where an incoming snapshot detached a Claim button mid-tap. The production static-build smoke test passes: connection, movement, Steps, trail preview, touch settings and XP/control clearance, with no page errors.

Matching-circuit software frame samples: 106.3–202.9 ms; 138–318 draw calls; 95–96 orbs. These sparse samples do not prove a performance improvement.

GitHub API requests to `api.github.com/graphql` are blocked by the environment network policy (Forbidden). The branch can be pushed through Git; automatic pull-request creation requires the saved API-domain network change to be applied.
