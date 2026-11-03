# Main City: engagement and systems

This update extends the cinematic integration in the same implementation branch, based on the latest `feature/smooth-movement-trails` commit `b571aa5`. Main remains untouched. Only World 1 is implemented; the existing six districts are neighborhoods of Main City.

## Before

A real 60-second automated browser keyboard circuit on the cinematic baseline reached Level 3, 624 Steps and 3 Gems, with no page errors. Movement, ring feedback, level notifications and trails provide an immediate loop. There was no useful Gem sink or companion collection, however, and the cosmetic journey mostly encourages more of the same collection. Races are absent. These are observed design limitations, not measured human retention findings.

The run used Chromium software rendering. Sampled frame times varied from about 31 to 199 ms and draw calls from 139 to 254. These are sparse scene-dependent observations, not a benchmark or evidence of real-phone performance. Source and results are in `tests/engagement-browser.mjs` and ignored `artifacts/engagement/before.json`.

## Main City

Eighteen new low-poly skyscrapers frame the existing districts; static geometry reuses the existing instancing batches. The skyline course has a new roof-level loop connected to the climbable tower. The central exploration circuit has continuous road surfacing and luminous edge markers. No fake race timer or results are shown: the circuit is an exploration route.

`shared/dayNight.ts` configures a 12-minute cycle. Clients derive daylight from the server snapshot clock, with blue daylight, warm dawn/dusk, readable moonlit nights and existing emissive windows/stars. It uses existing hemisphere/directional lights without adding dynamic point lights. Automatic time can be disabled for a personal night/day override in Settings.

## Orbs and rewards

There are 96 shared slots, sampled from continuous valid rectangles over plaza ground, grass, avenues, parks, promenade and accessible roofs. Points reject solids, ocean/bounds, ponds, monuments, crystal stations and close neighbors. Layouts are randomized from room creation. Roof zones are limited to surfaces with an actual accessible route. Existing route points remain decorative wayfinding markers, not a fixed spawn list.

Pickups replenish at a new random valid location within 1–3 seconds. Under a burst that empties the world, slots below the 50-orb floor become eligible on the next server tick. Typical population is 50–96; a brief within-tick burst may temporarily go lower. Gem weights are raised to provide a visible reason to gather and visit crystals. Renderer capacity is 100, reduced from 360. The active list is cached until a spawn/claim changes it, avoiding repeated allocations during room simulation.

Base Blue/Purple/Red Steps and XP remain 2/5/10 at Level 1 and 10/25/50 at Level 10. Existing trail statistics are unchanged. Orb Steps combine the trail result with the rebirth multiplier and equipped pet Steps multiplier; Gem-paying pickups combine the trail result with the pet Gems multiplier, rounded to whole Gems. Pets never create Gems on a non-Gem orb. Pet bonuses do not increase movement speed or XP. Rebirth retains its XP multiplier. The HUD shows the actual resulting server pickup values.

## Pets and crystals

Twelve original procedural species span Common, Rare, Epic and Legendary. One pet can be equipped; it follows the runner, survives rebirth/reconnect and replicates to other clients. Each species has defined Steps/Gems multipliers. Duplicate species add to the collection count, capped at 999, without stacking bonuses. All equipped companions render in three instanced draw calls, distance-cull at 120 units, and use shared geometry/materials; reduced-motion mode disables hovering.

Three physical stations use earned Gems only:

| Crystal | Cost | Location |
| --- | ---: | --- |
| Sunrise | 9 | Near spawn, (18,16) |
| Grove | 60 | Gardens, (-178,178) |
| Skyline | 180 | Course entrance, (78,62) |

The UI shows every pet and its exact percentage, totals 100%, and offers one opening at a time. There are no premium-currency purchases, auto-open controls or altered/hidden odds. Walk within 9 units and use E or the touch interaction button. The server checks proximity, height, Gems, request IDs, collection capacity and a 1.5-second opening rate limit. Cryptographic server randomness chooses the result. SQLite commits the Gem spend, pet ownership, first-pet auto-equip and unique transaction record atomically. Retrying the same request returns the original result without spending or granting again. Invalid requests cannot supply costs, odds or rewards.

## Optional one-minute offers

A nonmodal, dismissible offer becomes due after 60 seconds of active gameplay. It waits while moving/jumping, any dialog is open, a crystal is processing, the page is hidden, startup/disconnect/ad states are active, or another popup just closed. A 15-second quiet period after other popups prevents bursts. It alternates the supplied +1 Level and 2× Speed artwork. It never launches an ad automatically.

Watch Ad stays disabled because the production server verifier is unavailable. The official SDK banner path remains independent. Future race implementations must feed countdown/race state into the calm condition. No active race system exists in this build. Required verification inputs, safe adapter and transaction behavior are documented in the cinematic report.

## Validation and limits

Run `npm test` with the backend running, then `npm run build`. `node --import tsx tests/city-browser.mjs` seeds a separate test guest through the local database (no production cheat API), checks a real purchase through the UI, pets, settings, a genuine minute-long offer delay and mobile touch movement. `node tests/engagement-browser.mjs after` repeats the baseline keyboard circuit with a fresh guest.

SQLite saves need a durable disk and one server process; accounts, cross-device recovery, production platform ad validation and competitive races remain outside the implemented scope. Real enjoyment, multi-day retention, real-device FPS and 20-player load require human/device/load testing. The new loop provides a concrete Gem goal, visible companion reward, persistent collection and distinct crystal tiers; that creates plausible replay goals but is not measured retention evidence.

## After-run observations

The repeated 60-second keyboard circuit reached Level 3, about 581 Steps and 0 Gems, with no page errors and 95–96 active orbs. The baseline reached Level 3, 624 Steps and 3 Gems. This straight-line circuit did not improve pickup pacing; randomized layouts and fewer total orbs can leave a runner without Gems unless they steer toward pickups. The new compass and 9-Gem starter goal guide that choice, but early Gem pacing still needs human playtesting.

Pets and crystals add a concrete currency sink, visible reward and persistent collection. The city offers more landmarks and roof routes. These are stronger progression goals, not proof of greater enjoyment or retention. The separate browser purchase test successfully spent earned-currency fixture Gems, received a pet, equipped it and confirmed the full chances UI.

After-run software-rendering samples ranged from 97 to 188 ms, with 138–313 draw calls. Draw calls increased in this sampled route; real-device performance is not established. Orb rendering remains instanced and pets add at most three draw calls, but the existing scenery/material batches remain a profiling target.

The final regression suite passes 45/45 tests. The production bundle builds successfully (about 721 kB JavaScript, 205 kB gzip, with Vite’s large-chunk advisory). Browser checks cover desktop/mobile crystal UI, actual purchase and equipment, night settings, touch movement and a genuine minute-long disabled ad offer.
