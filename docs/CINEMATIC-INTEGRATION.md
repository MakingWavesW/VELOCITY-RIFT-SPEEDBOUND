# Cinematic gameplay integration

Base: `feature/smooth-movement-trails` at `b571aa5` (including uploaded assets).
Implementation branch: `feature/cinematic-gameplay-integration`.

## Assets and references

Both requested recordings were inspected locally using metadata and frames sampled every 5–7 seconds. Their compact counters, side navigation, broad lingering ribbons, pickup messages and athletic motion informed this implementation. No footage or third-party game art was extracted into the game.

The six official PNGs are served from `public/media/`. The purple button's black corners are clipped in CSS, preserving the supplied artwork. The available sunset image is named `Velocity Rift Sunset Run.png` (without `(1)`), and is the menu background. `image(20261102-163446).png` remains absent; it was not imported.

The studio MOV is now available. Its video was converted to H.264 1280×720 MP4 with fast start; its original AAC audio stream was copied unchanged. Only the video element can produce intro audio. The intro starts after an explicit sound/silent choice, fades to black, cleans up, and never replays on a room disconnect. It replays on a full page load. SDK initialization precedes this sequence; no imitation platform splash is supplied.

The two third-party MP3s remain reference inputs only and are not copied into public/ or dist/. Permission for commercial redistribution was not supplied. `src/media/audio.ts` supplies an original procedural music loop and original synthesized effects, with one music scheduler, voice limits, pickup rate limiting, notification ducking and immediate mute/pause handling.

## Gameplay and saves

Node.js 24 is required for the built-in SQLite API. Run `npm ci`, `npm run server`, and `npm run dev` in separate terminals. The backend stores guest progression in `.data/profiles.sqlite` (ignored); override `RIFT_PROFILE_DB` to point to durable storage. Mount and back up this directory on deployment. This implementation supports one Node process with its SQLite database; horizontal multi-process deployment needs a shared database and shared session locking.

A random 256-bit bearer credential identifies each saved runner. Only its hash is stored as the database key. The browser stores the credential locally; it is never included in snapshots or URLs. A valid credential can restore Level, XP, Steps, Gems, rebirths and trail ownership. One active connection per saved runner prevents concurrent save overwrites. Different browser contexts create distinct players. Clearing browser storage loses access; accounts and cross-device recovery are not included. Saves occur every five seconds, on trail equip, on rebirth and on normal disconnect; an abrupt process failure can lose the most recent unsaved movement.

Rebirth requires level `50 + 25 × existing rebirths`. It resets Level to 1 and XP/Steps to 0, preserves all Gems and unlocked/equipped trails, and adds 25% of base XP per rebirth. The Main City extension also applies this multiplier to orb Steps and preserves pet ownership/equipment. The server checks the requested expected rebirth count and eligibility; duplicate/stale confirmations cannot claim again. Existing trail statistics and all 77 entries are unchanged. Movement physics and collisions remain authoritative. Five-second ribbons use bounded pools and lower spatial sampling on low quality. Comfort mode reduces opacity, width and particles without changing gameplay.

Hero animations now use hinged elbows/knees, distance-based cadence, acceleration/braking/turning states, torso lean and stabilized heads. They are derived locally from predicted/interpolated movement; no limb animation is networked.

## Platform and monetization status

Official `@playgama/bridge` 2.4.0 is pinned. SDK initialize, game-ready, gameplay-started/stopped, platform pause/audio state and supported menu banner APIs are integrated. The SDK owns banner positioning; the menu reserves bottom space. Unsupported inventory produces no fake banner. Actual portal startup/banner delivery still requires a hosted Playgama validation run and the game's platform configuration. `public/playgama-bridge-config.json` is an empty automatic-detection configuration, not an invented game ID.

**Rewarded ads are intentionally unavailable pending a trusted verification integration.** The two official offer images are shown with an unavailable status. A request to the room receives an unavailable response. There is no client completion message that directly grants XP or speed. The platform wrapper supports the real rewarded API, but it is not invoked while secure reward verification is absent. The SDK's browser `rewarded` event cannot prove ad completion to an authoritative multiplayer backend. `server/rewardVerifier.ts` defines a disabled-by-default adapter. `server/rewards.ts` and SQLite implement five-minute transaction expiry, one outstanding offer per profile, five-minute cooldown after a successful grant, and atomic single-use grants saved with progression. Concurrent checks, mismatched users, expired/rejected proofs and duplicate claims are tested using an injected test-only verifier. No environment flag can enable fake verification. The UI confirmation and SDK playback flow are gated on both SDK support and server availability; callback closure requests a server check without asserting completion.

API references checked against the installed official package and current upstream source on 2026-11-03: [Bridge README](https://github.com/playgama/bridge#readme), [advertisement module](https://github.com/playgama/bridge/blob/main/src/modules/AdvertisementModule.ts), and the package TypeScript definitions. The README links the [official API wiki](https://wiki.playgama.com/playgama/bridge-sdk/api); this environment blocks that host with HTTP 403, so its live content could not be verified. The official source confirms browser `showRewarded`, reward-state events and `showBanner`; none supplies the missing trusted server integration for this game.

To activate: Playgama must supply an approved server completion API/webhook specification, authentication/signature verification rules (including key rotation and replay windows), production/sandbox game and placement configuration, a supported mapping between SDK/platform player identity and our guest profile plus transaction ID, provider event IDs, skip/failure semantics, retry policy and callback timing. The operator must implement the adapter, provider transaction correlation, deployment credentials via secure settings and hosted success/skip/failure/replay tests. No Playgama S2S endpoint or signature format is invented here. Hosted advertisement delivery and secure verification remain unverified.

`shared/progression.ts` contains tested server-side primitives for exactly +1 level (retaining partial XP) and non-stacking 2× speed for 120 seconds. The server expires speed using its clock and snapshots the multiplier; a boost countdown is supported in the UI and the expiry is persisted in the profile. These primitives have no public grant route until verification exists.

The base branch has cosmetic session journey objectives, orbs, hoops and trails, but no race implementation or ranked races. No fictitious race countdown/results were added. Countdown/finish sound vocabulary is available for a future real race system.

## Validation

`npm test` covers physics, network inputs, real WebSocket clients, orb authority, trails, progression, persistence, rejected forged rewards and reconnect.

`npm run build` performs TypeScript checking and creates dist/. Vite reports the existing large-bundle advisory; it does not prevent the build.

With backend and Vite running:

- `node tests/cinematic-browser.mjs`: real intro playback, exclusive audio, menu artwork, settings, inventory, rebirth eligibility, level notification baseline/deduplication fixtures and responsive layout. Results/screenshots: `artifacts/cinematic/`.
- `node tests/trail-effects-browser.mjs`: twelve rendered effect families and five-second history/expiry.
- `node tests/multiplayer-browser.mjs`: real two-player movement and delayed-network rendering.

Run timing-sensitive server tests separately from software-rendered browser tests. Software rendering and mobile emulation do not demonstrate real-device performance. The level-popup fixture explicitly tests presentation without granting server progress. Browser tests enter the real intro through `tests/menu-helper.mjs`.

The later Main City update is described in [MAIN-CITY.md](MAIN-CITY.md). It supersedes this report's orb count and adds pets, crystal purchases and a shared day/night cycle. All reward-verification restrictions still apply.

The [V5 release report](V5-RELEASE.md) supersedes earlier offer timing, reward UI, beginner spawn balance and cosmetic-only quest descriptions. Production ad verification remains disabled.
