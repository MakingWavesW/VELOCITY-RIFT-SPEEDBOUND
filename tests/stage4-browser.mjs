import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const expectations = {
  rewardDock: ["dailyButton", "playtimeButton", "questsButton", "achievementsButton"],
  primaryGameDock: ["", "", "petsButton", "shopButton", "inventoryButton", "", "parkourButton", "boostCenterButton"],
  socialDock: ["leaderboardButton", "redeemCodesButton"],
};
async function prepare(page) {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.locator("#rewardDock").waitFor({ state: "attached" });
  // Intro and main menu are intentionally hidden states. This is UI layout
  // inspection only; it does not claim a multiplayer player joined a room.
  assert.equal(await page.locator("#rewardDock").evaluate((el) => getComputedStyle(el).visibility), "hidden");
  await page.evaluate(() => {
    document.body.classList.remove("starting");
    document.getElementById("entry").style.display = "none";
    document.body.dataset.mediaState = "GAMEPLAY";
    const intro = document.getElementById("studioIntro");
    if (intro) intro.style.display = "none";
  });
  await page.waitForTimeout(90);
}
async function checkDocks(page) {
  for (const [dock, ids] of Object.entries(expectations)) {
    const buttons = page.locator("#" + dock + " > button");
    assert.equal(await buttons.count(), ids.length, dock + ": expected icon count");
    for (let n = 0; n < ids.length; n++) {
      if (ids[n]) assert.equal(await buttons.nth(n).getAttribute("id"), ids[n]);
    }
    assert.equal(await page.locator("#" + dock).evaluate((el) => getComputedStyle(el).visibility), "visible");
  }
  const icons = page.locator(".approved-icon-dock > button");
  assert.equal(await icons.count(), 15, "15 HUD + 5 inside popup = 20 original icons");
  for (const button of await icons.all()) {
    assert.ok(await button.getAttribute("aria-label"), "Every icon must have a screen-reader label");
    const img = button.locator("img");
    assert.equal(await img.count(), 1, "Original PNG icon element is present");
    if (await button.isHidden()) continue; // Parkour is unavailable until connected.
    const styling = await button.evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
    assert.ok(styling.width >= 43 && styling.height >= 43, "44px min touch target");
    assert.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(styling.background), "transparent icon background");
  }
  for (const id of ["dailyButton", "playtimeButton"]) {
    assert.equal(await page.locator("#" + id + " .ready-badge").count(), 1);
    assert.ok(await page.locator("#" + id + " .ready-badge").isHidden(), "No fake claimable badge");
  }
}
function rectanglesOverlap(a, b, padding = 0) {
  return a.x + a.width > b.x + padding &&
    b.x + b.width > a.x + padding &&
    a.y + a.height > b.y + padding &&
    b.y + b.height > a.y + padding;
}
try {
  const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  desktop.on("pageerror", (e) => errors.push(e.message));
  await prepare(desktop);
  await checkDocks(desktop);
  const xp = await desktop.locator(".levelbar").boundingBox();
  for (const button of await desktop.locator("#primaryGameDock > button").all()) {
    const rect = await button.boundingBox();
    assert.ok(rect && xp && !rectanglesOverlap(rect, xp), "Bottom icons cannot overlap XP bar");
  }
  // Menu actions must open the real dialogs; unsupported systems stay honest.
  await desktop.locator("#settingsDock button").click();
  assert.equal(await desktop.locator("#panel").evaluate((el) => el.open), true);
  await desktop.locator("#closePanel").click();
  await desktop.locator("#shopButton").click();
  assert.ok((await desktop.locator("#approvedMenuContent").innerText()).includes("requires visiting") ||
    (await desktop.locator("#approvedMenuContent").innerText()).includes("requires"));
  await desktop.locator("#closeApprovedMenu").click();
  await desktop.locator("#inventoryButton").click();
  assert.equal(await desktop.locator("#approvedMenuContent .approved-menu-action").count(), 2);
  await desktop.locator("#closeApprovedMenu").click();
  await desktop.locator("#redeemCodesButton").click();
  assert.ok((await desktop.locator("#approvedMenu").innerText()).includes("not available"));
  await desktop.locator("#closeApprovedMenu").click();

  await desktop.locator("#boostCenterButton").click();
  const cards = desktop.locator("#boostCenter .approved-boost-grid > article");
  assert.equal(await cards.count(), 5, "All 5 ad icons must stay within Boost Center");
  const boostSources = await cards.locator("img").evaluateAll((images) =>
    images.map((img) => img.dataset.originalAsset));
  assert.deepEqual(boostSources, [8,9,10,11,12].map((n) =>
    "/media/gui/" + String(n).padStart(2, "0") + "_" +
    ({8:"Rewarded_Ad",9:"Ad_XP_Boost",10:"Ad_XP_Boost_Timer",
      11:"Ad_Speed_Boost",12:"Ad_Speed_Boost_Timer"}[n]) + ".png"));
  assert.equal(await cards.locator("button:not([disabled])").count(), 0,
    "No live rewarded claims without trusted provider verifier");
  await desktop.locator('#boostCenter [aria-label="Close Power Boost Center"]').click();

  const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  });
  const landscape = await mobile.newPage();
  await prepare(landscape);
  await checkDocks(landscape);
  assert.ok(!(await landscape.locator("#landscapeOrientation").isVisible()));
  const joystick = await landscape.locator("#touch").boundingBox();
  const jump = await landscape.locator("#jump").boundingBox();
  const buttons = await landscape.locator("#primaryGameDock > button").all();
  for (const b of buttons) {
    const rect = await b.boundingBox();
    assert.ok(rect && !rectanglesOverlap(rect, joystick), "Dock does not cover touch joystick");
    assert.ok(rect && !rectanglesOverlap(rect, jump), "Dock does not cover touch jump");
  }
  await landscape.setViewportSize({ width: 390, height: 844 });
  assert.ok(await landscape.locator("#landscapeOrientation").isVisible());
  await mobile.close();

  assert.deepEqual(errors, [], "No uncaught Stage 5 GUI errors");
  console.log("Approved 20-icon HUD desktop + landscape smoke tests passed.");
} finally {
  await browser.close();
}
