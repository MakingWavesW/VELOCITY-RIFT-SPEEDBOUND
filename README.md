# VELOCITY RIFT: SPEEDBOUND
Original multiplayer speed-game foundation by Vyrnora Studios.

## Run on Windows, macOS or Linux
Install Node.js 22.12+ (validated here with Node 24). From this directory:

```sh
npm ci
npm run server
```
Leave that terminal running. Open a second terminal in the same directory:

```sh
npm run dev
```
Open the Vite address printed in the terminal in two browsers. Enter names and join. Both connect to the actual Colyseus room. Maximum room capacity is 20; matchmaking creates another room when full. No simulated players are added.

Controls: WASD/arrows move, Space jumps, drag the world to orbit, wheel zooms. Touch devices have directional and jump buttons. Hello sends a server-rate-limited preset message.

## Implemented
Three.js scene with original procedural characters, animated limbs, nameplates, orbit/follow camera, shared glowing collectibles, server-controlled movement at 25 Hz, sequenced input, local prediction and reconciliation, remote interpolation, Steps/XP/levels/speed/Gems, shared orb cooldowns, live player roster and connection/error UI. Server alone awards rewards. Each orb has a 10-second shared cooldown. Progress is **session-only** and resets on reconnect. The decorative ring is scenery, not a reward hoop or portal.

## Validation
`npm run build` type-checks and builds `dist/`.
With the backend running, `npm test` exercises two real WebSocket clients: room membership, movement, jump, shared pickup, invalid movement/currency spoof rejection and leaving. It also tests malformed inputs.
`node tests/browser.mjs` uses installed `/usr/bin/chromium` for browser smoke tests (edit executablePath for other operating systems). Automated clients are test clients, not human playtest evidence.

## Deployment
Client and backend deploy separately. `dist/` contains only the static browser application. Set `VITE_SERVER_URL=wss://your-backend.example` in `.env` **before** `npm run build`; never put credentials in Vite variables. Serve the client over HTTPS. Run `npm ci` and `npm run server` on a persistent Node host; use `PORT` (default 2567), a TLS reverse proxy with WebSocket upgrades, and `/health` for readiness. Development dependencies currently include the backend TypeScript runner, so do not use `npm ci --omit=dev`. Restrict allowed origins at the production proxy. Budget for a persistent server and bandwidth. This foundation has not been hardened for public production.

## Unfinished release work
PostgreSQL identity and transactional progression, authenticated reconnect, accounts, private parties/room codes, region/latency selection, races/checkpoints/results, global rankings, upgrades/rebirth, pets/trails/crystals, quests, reward hoops/ramps, additional dimensions, sound, joystick, camera obstacle avoidance, platform SDKs, deployment automation and load/latency tests remain unfinished. No fake buttons or fabricated leaderboards represent these systems. Twenty is configured capacity, not a measured performance claim. Mobile/Safari/Firefox performance and human two-browser playtesting remain unverified. The independent online backend is not a YouTube Playables-compatible edition.

## Architecture
- `shared/game.ts`: deterministic movement, balance and input validation.
- `server/index.ts`: Colyseus room, authoritative simulation and rewards, health route.
- `src/main.ts`, `src/style.css`: renderer, input, networking and HUD.
- `tests/`: protocol and browser checks.

Future production persistence should use opaque, server-issued guest session cookies and PostgreSQL profiles, transactional purchases/rewards, unique action IDs and ownership locks. Optional account linking must authenticate ownership before attaching a guest profile. Local browser storage cannot securely recover identity after deletion. Add these before promising saved online progression.
