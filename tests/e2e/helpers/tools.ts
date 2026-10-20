import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// D76 M2: editor controls live in tool panels; only the chosen panel is visible.
const rail = (page: Page): Locator => page.getByRole('navigation', { name: /^(Tools|टूल्स)$/ });
const panelOf = async (button: Locator, page: Page): Promise<Locator> => page.locator(`#${await button.getAttribute('aria-controls')}`);

/**
 * Opens the named tool panel (English or Hindi rail label); does nothing when it is already open.
 * Retries when a page navigation (for example a sign-in redirect) remounts the editor and closes the panel meanwhile.
 */
export async function openTool(page: Page, name: string): Promise<void> {
  const button = rail(page).getByRole('button', { name, exact: true });
  await expect(async () => {
    if ((await button.getAttribute('aria-pressed', { timeout: 5000 })) !== 'true') await button.click({ timeout: 5000 });
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    await expect(await panelOf(button, page)).toBeVisible({ timeout: 1000 });
    await page.waitForTimeout(150);
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 500 });
  }).toPass({ timeout: 15000 });
}

/** Closes whichever tool panel is open; does nothing when none is open. */
export async function closeTool(page: Page): Promise<void> {
  const button = rail(page).locator('button[aria-pressed="true"]');
  if ((await button.count()) === 0) return;
  const panel = await panelOf(button, page);
  await button.click();
  await expect(panel).toBeHidden();
}

/**
 * After a reload the page may show the editor or another screen (for example the recovery screen). Waits for either,
 * then opens the named panel only when the editor's tool rail is there.
 */
export async function openToolIfShown(page: Page, name: string, otherScreen: Locator): Promise<void> {
  const button = rail(page).getByRole('button', { name, exact: true });
  await expect(button.or(otherScreen).first()).toBeVisible({ timeout: 15000 });
  if (await button.isVisible()) await openTool(page, name);
}
