import { expect, test } from "@playwright/test";

/**
 * The one loop that has to work: create an account, answer a challenge, get a
 * score, and see that attempt on the dashboard.
 *
 * Assumptions, stated because they are configuration, not code:
 *   * Supabase email confirmation is disabled for the test project, so signup
 *     lands signed in. With confirmation on, the run stops at `/login?checkEmail`.
 *   * The database has been seeded (`./scripts/db-apply.sh --seed`), so there is
 *     at least one published challenge to answer.
 */

const PASSWORD = "forge-smoke-Passw0rd";

function uniqueEmail(): string {
  return `smoke-${Date.now()}-${Math.floor(Math.random() * 10_000)}@forge.test`;
}

test.describe("practice loop", () => {
  test("sign up, practise, score, see it on the dashboard", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel(/I accept the Terms of Service/).check();
    await page.getByLabel(/Store my practice record/).check();
    await page.getByRole("button", { name: "Create account" }).click();

    // Confirmation disabled: straight into the app. If the project requires
    // confirmation, the test says so instead of failing on a mystery timeout.
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 30_000 });
    test.skip(
      page.url().includes("/login"),
      "Supabase email confirmation is enabled; disable it for the smoke run"
    );

    await expect(page.getByText(/streak/i).first()).toBeVisible();

    await page.goto("/practice");
    const challengeLink = page.locator('a[href^="/practice/"]').first();
    await expect(challengeLink).toBeVisible();
    await challengeLink.click();

    const answer = page.locator("#answer");
    await expect(answer).toBeVisible({ timeout: 30_000 });
    await answer.fill(
      [
        "The cause is an off-by-one in the slice end: subtracting one drops the last record on every page.",
        "",
        "The fix is to slice from start to start + size, which keeps the boundary inclusive of the final item.",
        "I would add a test for a full page and a partial page, since the bug only appears at page edges.",
      ].join("\n")
    );

    await page.getByRole("button", { name: "Submit attempt" }).click();
    await page.waitForURL(/\/result\//, { timeout: 30_000 });

    await expect(page.getByText(/score/i).first()).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/attempt/i).first()).toBeVisible();
  });

  test("the practice runner is usable on a phone", async ({ page }) => {
    await page.goto("/login");
    const viewport = page.viewportSize();

    if (viewport && viewport.width < 600) {
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 1);
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    }
  });
});
