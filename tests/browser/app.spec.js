import { test, expect } from '@playwright/test';
const key = 'daymark:tasks:v1';
async function add(page, text) {
  await page.getByRole('textbox', { name: 'New task' }).fill(text);
  await page.getByRole('button', { name: 'Add task' }).click();
}
test.beforeEach(async ({ page }) => { await page.goto('/'); });
test('starts empty with correct counters', async ({ page }, info) => {
  await expect(page.getByText('A clear space. A fresh start.')).toBeVisible();
  await expect(page.locator('#total-count')).toHaveText('0');
  await expect(page.locator('#progress-section')).toBeHidden();
  await page.screenshot({ path: `test-results/empty-${info.project.name}.png`, fullPage: true });
});
test('adds via button and Enter, trims text and persists order', async ({ page }) => {
  await add(page, '  Plan the weekend  ');
  const input = page.getByRole('textbox', { name: 'New task' });
  await expect(input).toBeFocused();
  await input.fill('Read a chapter'); await input.press('Enter');
  await expect(page.locator('.task-text')).toHaveText(['Read a chapter', 'Plan the weekend']);
  await page.reload();
  await expect(page.locator('.task-text')).toHaveText(['Read a chapter', 'Plan the weekend']);
  await expect(page.locator('#total-count')).toHaveText('2');
});
test('rejects whitespace and constrains task length', async ({ page }) => {
  await add(page, '   ');
  await expect(page.locator('.task-row')).toHaveCount(0);
  expect(await page.locator('#task-input').evaluate(input => input.validity.valid)).toBe(false);
  await add(page, 'A valid task');
  await expect(page.locator('.task-row')).toHaveCount(1);
  await expect(page.locator('#task-input')).toHaveAttribute('maxlength', '180');
});
test('marks complete, updates progress, persists and reopens', async ({ page }) => {
  await add(page, 'Water the plants');
  await page.getByRole('checkbox', { name: 'Water the plants' }).check();
  await expect(page.locator('#completed-count')).toHaveText('1');
  await expect(page.locator('#active-count')).toHaveText('0');
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '100');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Water the plants' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Water the plants' }).uncheck();
  await expect(page.locator('#active-count')).toHaveText('1');
});
test('filters active and completed tasks with meaningful empty states', async ({ page }) => {
  await add(page, 'Read a chapter'); await add(page, 'Take a walk');
  await page.getByRole('checkbox', { name: 'Take a walk' }).check();
  await page.getByRole('radio', { name: 'Active', exact: true }).check();
  await expect(page.locator('.task-text')).toHaveText(['Read a chapter']);
  await page.getByRole('radio', { name: 'Completed', exact: true }).check();
  await expect(page.locator('.task-text')).toHaveText(['Take a walk']);
  // This checkbox leaves the filtered list immediately after the click.
  await page.getByRole('checkbox', { name: 'Take a walk' }).click();
  await expect(page.getByText('Your wins will live here.')).toBeVisible();
});
test('adding from the completed filter makes the new task visible', async ({ page }) => {
  await page.getByRole('radio', { name: 'Completed', exact: true }).check();
  await add(page, 'A fresh task');
  await expect(page.getByRole('checkbox', { name: 'A fresh task' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /All tasks/ })).toBeChecked();
});
test('deletes persistently and undo restores the original completion and order', async ({ page }) => {
  await add(page, 'First task'); await add(page, 'Second task');
  await page.getByRole('checkbox', { name: 'First task' }).check();
  await page.getByRole('button', { name: 'Delete task: First task', exact: true }).click();
  await expect(page.locator('.task-text')).toHaveText(['Second task']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.task-text')).toHaveText(['Second task', 'First task']);
  await expect(page.getByRole('checkbox', { name: 'First task' })).toBeChecked();
  await page.getByRole('button', { name: 'Delete task: First task', exact: true }).click();
  await page.reload();
  await expect(page.locator('.task-text')).toHaveText(['Second task']);
});
test('all completed active view celebrates completion', async ({ page }) => {
  await add(page, 'Finish one thing');
  await page.getByRole('radio', { name: 'Active', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Finish one thing' }).click();
  await expect(page.getByText('All caught up. Nicely done.')).toBeVisible();
  await expect(page.locator('#progress-percent')).toHaveText('100%');
});
test('handles unavailable storage while keeping tasks usable', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked'); } }); });
  await page.reload();
  await add(page, 'A session task');
  await expect(page.getByRole('checkbox', { name: 'A session task' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('may be lost');
  await expect(page.locator('#save-status')).toContainText('this visit only');
  await page.getByRole('checkbox', { name: 'A session task' }).check();
  await page.getByRole('button', { name: 'Delete task: A session task' }).click();
  await expect(page.locator('.task-row')).toHaveCount(0);
});
test('warns when storage quota is exceeded', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.reload(); await add(page, 'Still usable');
  await expect(page.getByRole('alert')).toContainText('storage is unavailable or full');
  await expect(page.locator('.task-text')).toHaveText(['Still usable']);
});
test('recovers valid records from damaged storage', async ({ page }) => {
  await page.evaluate(({ key }) => localStorage.setItem(key, JSON.stringify([null, { id: '1', text: 'Recovered task', completed: true }])), { key });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Recovered task' })).toBeChecked();
  await expect(page.getByRole('alert')).toContainText('valid tasks are still available');
});
test('treats user text as text and fits narrow screens', async ({ page }) => {
  await add(page, '<img src=x onerror=alert(1)>' + 'long'.repeat(30));
  await expect(page.locator('.task-text img')).toHaveCount(0);
  await expect(page.locator('.task-text')).toContainText('<img');
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
test('supports keyboard completion and preserves a useful focus target', async ({ page }) => {
  await add(page, 'Keyboard task');
  const checkbox = page.getByRole('checkbox', { name: 'Keyboard task' });
  await checkbox.focus(); await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked(); await expect(checkbox).toBeFocused();
  await page.getByRole('button', { name: 'Delete task: Keyboard task' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'New task' })).toBeFocused();
});
test('creates a representative visual preview', async ({ page }, info) => {
  for (const text of ['Make time for a walk outside', 'Read a chapter of that book', 'Plan the weekend', 'Finish the project outline']) await add(page, text);
  await page.getByRole('checkbox', { name: 'Read a chapter of that book' }).check();
  await page.getByRole('checkbox', { name: 'Make time for a walk outside' }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/preview-${info.project.name}.png`, fullPage: true });
});
