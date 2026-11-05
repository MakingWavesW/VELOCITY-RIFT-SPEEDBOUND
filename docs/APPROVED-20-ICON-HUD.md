# VELOCITY RIFT: SPEEDBOUND — Approved 20-Icon GUI Placement

Branch: `feature/approved-20-icon-hud` (based on Stage 4). Main game world, GLB renderer, multiplayer server, persistence, Playgama SDK and original game controls are preserved.

## Original icon artwork

The exact PNGs come from the user-provided `SPEEDBOUND_20_Individual_GUI_Buttons` ZIP, `Original_PNGs/` directory. **They are binary assets packaged as a separate small installation overlay** named `VELOCITY_RIFT_APPROVED_20_ICON_GUI_OVERLAY.zip`. Do not claim the GitHub source ZIP already includes those 20 PNGs. It includes the appropriate bindings and procedural/existing-art fallbacks instead. Install the overlay before a final visual acceptance test.

1. Download this branch as a GitHub ZIP.
2. Extract it.
3. Extract the GUI overlay ZIP directly into the same extracted root, merging `public/media/gui/`.
4. Verify the file paths `public/media/gui/01_Rebirth.png` … `public/media/gui/20_Redeem_Codes.png`.
5. Run `START_GAME_WINDOWS.bat` with Node 24+ installed.
6. Play at `http://127.0.0.1:5173/`; keep the game server active for multiplayer.

The user-provided placement board (desktop 1672×941 reference) is the visual target.

## Exact twenty icon positions

**Top-right (1):** 03 Settings, attached to the original Settings handler.

**Left column (4), beneath Campaign:** 06 Daily Rewards, 07 Playtime Rewards, 16 Daily Quests/Goals, 17 Achievements.

**Bottom middle (8):** 01 Rebirth, 02 Trails, 04 Pets, 05 Shop, 18 Inventory, 15 World Map (art labels it Teleport), 14 Skybound (art labels it Race), 19 Power Boost.

**Right column (2):** 13 Live Room Leaderboard, 20 Redeem Codes.

**Inside Power Boost popup (5):** 08 Rewarded Ad (+1 Level), 09 Instant XP, 10 Timed 2× XP, 11 Instant Speed, 12 Timed 2× Speed.

No extra HUD icon artwork was invented. Existing Help and Hello actions remain available within the Live Room menu. Rewards use the existing authoritative claimability state; notifications are not fabricated.

## Functional and unavailable features

- **Working original actions:** Settings, Rebirth, Trails, Pets, Daily Rewards, Playtime Rewards, Daily Quests, World Map, Skybound parkour challenges, Power Boost.
- **New read-only real-data menus:** Shop catalogs existing Crystal prices and locations; player still must visit a Crystal to purchase. Inventory lets the player open the existing Pets and Trails inventories.
- **Leaderboard:** shows only actually connected Colyseus players and their current Level/Steps from server snapshots. This is **not** a persistent/global leaderboard.
- **Achievements:** shows the existing local Runner Journey session milestones, not permanent platform trophies or a new reward-grant service.
- **Redeem Codes:** no redemption backend exists. The icon opens an honest unavailable explanation; no invented codes or rewards.
- **World Teleport:** the visual icon opens the real island map. Remote teleportation is not implemented and is not faked.
- **Race:** the visual icon opens existing functional Skybound timed parkour, not a new head-to-head race system.
- **Power Boost:** 08 links to existing +1 Level, 10 links to existing 2× XP for 3 minutes, 12 links to existing 2× Speed for 2 minutes. Instant variants 09 and 11 remain unavailable; they have no existing verified server backend. All production rewarded ads remain disabled until an approved trusted server-side verifier is configured.

## UX notes

- Icon size: Settings 60px, left 70px, bottom 66px and right 62px on desktop. All are 44px minimum on short landscape devices.
- Transparent PNG backgrounds; no added tiles, text painted over artwork or distortion.
- Mild hover scale (1.06), press scale (0.94), matching drop-shadow and reduced-motion compliance.
- Existing red claimable `!` indicators remain attached to their original server-backed Daily and Playtime buttons; unclaimed state is preserved through DOM reparenting.
- Original clickable handlers are preserved on moved elements, not recreated as dummy proxies.
- Bottom dock is separated vertically from XP/Level bar, and short landscape CSS preserves joystick/jump access.
- Intro, main menu and full-screen advertisements hide gameplay docks without removing the menu Settings control.

## Verification

The CI workflow `.github/workflows/approved-icon-hud-validation.yml` runs:
- `npm ci`
- `npm run build`
- Real-server `npm test` multiplayer/progression checks
- Playwright Chromium smoke test `node tests/stage4-browser.mjs`

The Playwright test covers the exact 15-icon HUD structure, 5 boost cards, honest unavailable rewards, reward badges, functional Settings/Shop/Inventory/Redeem menus, desktop dock–XP separation, and mobile landscape–joystick/jump spacing. In source-only CI, missing optional PNG assets should use the fallback rather than pretending the original PNG is present. For exact image-quality acceptance, merge the original overlay and capture real browser screenshots on desktop and mobile.

**Release remains gated by:** verified original-PNG asset installation, real Playgama banner delivery, public WSS Colyseus hosting, trusted S2S rewarded-ad verification, and physical mobile-device validation. No existing ads/security controls are bypassed.
