# Sunburst Plaza — visual reference integration

**Reference supplied by the user:** vivid, Roblox-inspired, colorful 3D Sunburst City artwork with a golden circular landmark, dark slate curving roads framed by neon cyan edges, bright green lawn, pink/cyan/violet toy-like skyscrapers, hovering colored orbs, simplified faceted trees and rolling hills, bright blue sky and soft clouds.

**Source branch:** `feature/approved-20-icon-hud`.

**Feature branch:** `feature/sunburst-reference-environment`.

This implements the reference's **3D art direction in the real Three.js scene**, rather than replacing gameplay with a flat image or a new loading-screen background.

## Implemented

- Brighter mint grass, warm cream plaza/paving, clearer slate asphalt, turquoise sea and blue daytime sky.
- Saturated cyan/pink/violet/gold/mint building palette while preserving each original GLB footprint and server-authoritative solid. A brighter green foliage material keeps the uploaded Kenney assets coherent.
- Efficient cyan-edged shoulders along the existing road grid. Uses `Batch` instancing with no new physical road surfaces.
- Warm and cyan concentric ground accents around the original central roundabout, with shrubs and flower details placed **inside already blocked planter footprints**.
- A prominent sun-gold ornamental frame around the real **Solar Hoop at (0, 8, -68)**, plus animated aqua inner trim and sixteen GPU-instanced sun rays. This is VISUAL ONLY: no new hoop collision, XP, teleport, or reward.
- Seven low-poly colored skyline hills placed strictly beyond the 440-unit gameplay world boundary. No terrain physics or extra GLB asset requests.
- More luminous colored orb halos; unchanged orb position, tier, reward and replication logic.
- Night/low-motion support: the gold gate responds gently to day/night; reduced motion stops rotations and pulsing.
- New `tests/sunburst-reference.test.ts` verifies the actual frame matches the authoritative Solar Hoop position and that `solids`, `ramps` and `hoops` are untouched.
- Real browser screenshot capture with a joined Colyseus player, used to inspect the updated city and UI in context rather than present the supplied reference illustration as gameplay.

## Files

- New: `src/world/sunburstReference.ts`, `tests/sunburst-reference.test.ts`, `tests/sunburst-reference-browser.mjs`, `.github/workflows/sunburst-reference.yml`.
- Updated: `src/world/environment.ts`, `src/world/landscape.ts`, `src/world/cityLayout.ts`, `src/world/glbCity.ts`, `src/world/orbs.ts`.
- Unmodified: `shared/world.ts`, `shared/game.ts`, multiplayer server, player controller, GLB asset manifest, Trails, Pets, Crystals, currency, saving, ads/Playgama, original approved 20-icon GUI.

## Validation

```bash
npm ci
npm run build
npm run server                # terminal one
npm run dev                   # terminal two
npm test
npx playwright install chromium
node tests/sunburst-reference-browser.mjs
```

GitHub Actions workflow `Sunburst Reference Environment` runs the above automatically on this branch and uploads real gameplay screenshot evidence as a downloadable workflow artifact. Screenshot artifact is from local multiplayer Chromium with software WebGL, **not** a finished public Playgama host, a physical-phone benchmark, or a direct copy of the image reference.

## Release safeguards

- This is a visual-only feature, with no new rewards or inauthentic orb spawn positions.
- Preserve the base `feature/approved-20-icon-hud` branch and `main` unchanged.
- Do not merge without a passing build, the new tests, and final user review of the screenshot.
- The exact original 20 PNG GUI icon overlay remains a separate binary ZIP until installed in a release build.
