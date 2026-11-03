export async function enterMenu(page) {
  if (!(await page.locator("#studioIntro").count())) return;
  await page
    .locator("#beginIntro")
    .waitFor({ state: "visible", timeout: 30000 });
  await page.locator("#silentIntro").click();
  if (!(await page.locator("#studioIntro video").evaluate((v) => v.muted)))
    throw Error("Silent intro must stay muted");
  await page
    .locator("#studioIntro")
    .waitFor({ state: "detached", timeout: 30000 });
}
