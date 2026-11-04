# Stage 4 — Compact GUI, optional audio, streaming fog and Playgama Bridge

Base branch: `feature/glb-pets-ramps-stage3`.
Working branch: `feature/playgama-gui-polish-stage4`.
The source game, existing Colyseus backend, authoritative physics, GLB Hero/Pets, Trails, orbs, Crystals, Rebirths and saves remain intact.

## Implemented

### Gameplay GUI

- A single Settings button is docked at the upper-right within mobile safe areas.
- The existing **Campaign/Goals**, **Daily Rewards** and **Playtime Rewards** actions form an icon-only vertical dock on the left, in that order.
- Existing Pets, Trails, Rebirth, Map, How To Play, Hello, Boost Center and Skybound actions remain available as a horizontal compact dock.
- Original icon assets are rendered with their aspect ratio preserved; no visible square backgrounds or permanent text labels. Hover/press transforms do not change layout footprint. Names remain available to screen readers and keyboard users.
- The existing server-backed reward availability controls the red exclamation point badge: no independent client countdown or fake ready signal.
- Mobile portrait displays a landscape notice and suspends input/game audio. Landscape resumes normal behavior. No new portrait gameplay layout.
- Gameplay docks are hidden during the studio intro, the main menu and full-screen ads; the existing menu Settings button remains.
- Optional user-provided PNG overlay paths: `public/media/gui/01_Rebirth.png`, `02_Trails.png`, `03_Settings.png`, `04_Pets.png`, `06_Daily_Rewards.png`, `07_Playtime_Rewards.png`, `08_Rewarded_Ad.png`, `14_Race.png`, `15_World_Teleport.png` and `16_Daily_Quests.png`. The rest of the twenty supplied PNGs are preserved in the optional overlay but not used for nonexistent features.
- The full original 20-icon overlay is delivered separately with this review build, rather than being committed as binary assets to this source branch. If it has not been installed, existing game art and text-free emoji fallbacks are used. **A production UI release must incorporate the approved PNG pack**.

### Audio

- `GameAudio` supports optional `public/media/city-music.mp3` and `public/media/level-up-sfx.mp3` loaded after a real user gesture. Audio loops only during gameplay, pauses during intro/ads/tab pause, obeys master/music/SFX/mute settings, and prevents double-playing the original procedural background composition.
- Level-up sample plays once when the authoritative Level Celebration popup triggers. Existing procedural level-up tones remain fallback when sample is absent.
- The supplied MP3 filenames refer to recordings from another game. **Do not publish those recordings without verifying the copyright and public-distribution rights.** A separate local-use asset overlay demonstrates the integration. This GitHub branch intentionally does not publish those audio files.

### Atmosphere

- Main City distance fog now blends into the actual sky and day/night cycle. High/Medium/Low settings target 170–560, 140–460 and 100–340 world units respectively, coordinated with the existing streamed GLB city. No extra full-screen postprocess pass.

### Playgama

- Preserves `@playgama/bridge@2.4.0`. The V2 config declares landscape-only support and a custom rotate notice.
- Uses SDK readiness and gameplay lifecycle events. Bottom sticky banner requests happen on the main menu only, only if officially supported by the host, and banner state controls layout reservations.
- Rewarded ad events distinguish `loading`, `opened`, `rewarded`, `closed`, and `failed`; browser completion alone never grants server rewards. Only the `rewarded` state permits a verification request. Closed/failed/no-fill and timeouts release the paused audio/input state without a reward.
- **Live rewarded verification is still unavailable.** `server/rewardVerifier.ts` deliberately returns `available: false`; a trusted Playgama/provider S2S verification path and credentials are required before enabling offers. No client-side bypass was added.
- No simulated banner close button or third-party ad content has been inserted. Live ad delivery still requires the approved Playgama host and account.

## Local Windows test

1. Download this source branch as a ZIP and extract the entire repository.
2. Extract the supplied `VELOCITY_RIFT_STAGE4_GUI_AUDIO_OVERLAY.zip` **into the extracted game root** (merging its `public/` folder). Original PNGs should be at `public/media/gui/`. The audio files are for private local evaluation only until licensed.
3. Install Node.js 24+ and run `START_GAME_WINDOWS.bat`.
4. Verify the main menu, intro, the gameplay UI after joining, Settings at top-right, Campaign/Daily/Playtime at left, no white backgrounds, and rewards only when the server marks them claimable.
5. Rotate a mobile device (or emulate touch/portrait in Chromium): the game should request landscape. On landscape the overlay must disappear.
6. Test two players together. Check that the Stage 3 ramps, Pets, saved profiles, orbs and Trails still function.

## Automated validation

```sh
npm ci
npm run build
npm run server                 # separate terminal
npm run dev                    # separate terminal
npm test
npx playwright install chromium
node tests/stage4-browser.mjs
```

The build stages exactly the runtime GLBs using existing Stage 2 tooling. A Stage 4 GitHub Actions workflow was added to run TypeScript build, multiplayer tests and Chromium browser smoke checks.

**No passing build, browser, mobile device or Playgama ad run is claimed without CI or local execution evidence.**

## Deployment blockers

1. **Secure server URL**: The Playgama-hosted Vite frontend needs an accessible secure `wss://` Colyseus endpoint, provided via `VITE_SERVER_URL` **at build time**. Local `localhost:2567` cannot serve public Playgama players.
2. **Reward verification**: Configure an approved trusted S2S verification adapter before enabling the rewarded offers. `server/rewardVerifier.ts` remains disabled.
3. **Audio rights**: Ensure ownership/licenses for any released music/SFX. Replace the provided third-party tracks with licensed/original recordings if not authorized.
4. **Original icon packaging**: Merge the provided PNG overlay into the final working source before production build or uploading to GitHub.
5. **Platform/device testing**: Test real Playgama hosting, banner fill/no-fill, rewarded callback/verification, pausing/resuming, mobile landscape, and both connected players.

No fictitious SDK approval, live ads, or deployed multiplayer backend has been claimed.
