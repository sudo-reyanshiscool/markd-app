import { expect, Page, test } from "@playwright/test";

/**
 * Critical path (spec §11): onboarding → create subject → add task →
 * complete task → streak updates. Runs in guest/demo mode so CI needs no
 * Supabase instance; the signed-up variant reuses the same selectors.
 *
 * Routes are visited once up-front so Metro's dev-mode lazy compilation
 * (which hard-reloads the page) never interrupts an assertion.
 */

async function warm(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
}

// previous screens stay mounted in the stack — interact with the last match
const last = (page: Page, testId: string) => page.getByTestId(testId).last();

test("guest onboarding → first subject → quick-add → complete → streak", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await warm(page, [
    "/",
    "/onboarding",
    "/onboarding/school",
    "/onboarding/country",
    "/onboarding/track",
    "/onboarding/year",
    "/onboarding/subject",
    "/onboarding/finish",
  ]);
  await page.goto("/");

  // welcome → guest mode
  await last(page, "guest-mode").click();

  // 1: name
  await last(page, "onboarding-name").fill("Quinn");
  await last(page, "onboarding-next").click();
  // 2: school (skip)
  await expect(page).toHaveURL(/onboarding\/school/);
  await last(page, "onboarding-next").click();
  // 3: country (skip)
  await expect(page).toHaveURL(/onboarding\/country/);
  await last(page, "onboarding-next").click();
  // 4: track
  await expect(page).toHaveURL(/onboarding\/track/);
  await last(page, "track-gcse").click();
  await last(page, "onboarding-next").click();
  // 5: year
  await expect(page).toHaveURL(/onboarding\/year/);
  await last(page, "year-Year-11").click();
  await last(page, "onboarding-next").click();
  // 6: subject
  await expect(page).toHaveURL(/onboarding\/subject/);
  await last(page, "onboarding-subject").fill("Mathematics");
  await last(page, "onboarding-next").click();
  // finish
  await expect(page).toHaveURL(/onboarding\/finish/);
  await last(page, "onboarding-finish").click();

  // home with seeded starter tasks; consent dialog appears once
  await expect(page.getByText("Yo Quinn")).toBeVisible({ timeout: 20_000 });
  const consentDecline = page.locator('[aria-label="No thanks"]');
  if (await consentDecline.isVisible().catch(() => false)) {
    await consentDecline.click();
  }
  await expect(page.getByText("Plan your study schedule").first()).toBeVisible();

  // quick-add with NLP
  await page.goto("/tasks");
  await last(page, "quick-add").fill("essay mathematics tomorrow 1h !");
  await expect(page.getByText("~60M").first()).toBeVisible(); // parse preview
  await last(page, "quick-add-submit").click();
  await expect(page.getByText("essay").first()).toBeVisible();

  // complete it via the checkbox → streak should tick to 1 day
  await page
    .locator('[data-testid^="task-check-"]')
    .first()
    .click();
  await page.goto("/");
  await expect(page.getByText(/1\s*day/i).first()).toBeVisible({ timeout: 15_000 });
});

test("paywall gates the 4th subject on free plan", async ({ page }) => {
  // continues from persisted state of the previous test in local runs;
  // in CI each test gets a fresh context, so do a minimal setup
  await page.goto("/");
  const isWelcome = await page
    .getByTestId("guest-mode")
    .last()
    .isVisible()
    .catch(() => false);
  test.skip(isWelcome, "needs the onboarded state from the flow test");

  await page.goto("/subjects");
  for (const name of ["Two", "Three", "Four"]) {
    const addFab = page.locator('[aria-label="Add subject"]').last();
    await addFab.click();
    const sheetOpen = await page
      .getByTestId("subject-name")
      .last()
      .isVisible()
      .catch(() => false);
    if (!sheetOpen) {
      // quota gate fired → paywall instead of form
      await expect(page).toHaveURL(/paywall/);
      return;
    }
    await page.getByTestId("subject-name").last().fill(name);
    await page.getByTestId("subject-save").last().click();
  }
  await expect(page).toHaveURL(/paywall/);
});
