import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cashFigure = (page: Page) => page.getByTestId('cash-figure');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(cashFigure(page)).toBeVisible();
});

test('first screen shows the contractor example computed from the model', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What changes in cash. What changes in capacity.');
  await expect(cashFigure(page)).toHaveText('+$3,500');
  await expect(page.getByTestId('hours-figure')).toHaveText('+100 h');
  await expect(page.getByTestId('retained-hours')).toHaveText('0.0 h');
  await expect(page.getByTestId('payback')).toHaveText('Month 2');
  await expect(page.getByTestId('year-one')).toHaveText('+$35,000');
  await expect(page.getByTestId('plan-figure')).toHaveText('Not modelled');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test('preset cards switch scenarios and show each example from the model', async ({ page }) => {
  await page.locator('[data-preset="fixed-payroll"]').click();
  await expect(cashFigure(page)).toHaveText('-$500');
  await expect(page.getByTestId('year-one')).toHaveText('-$7,200');
  await expect(page.getByTestId('hours-figure')).toHaveText('+100 h');
  await expect(page.getByTestId('retained-hours')).toHaveText('100.0 h');
  await expect(page.getByTestId('payback')).toHaveText('No payback in 12 months');
  await expect(page.locator('[data-preset="fixed-payroll"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-preset="contractor-ramped"]').click();
  await expect(page.getByTestId('payback')).toHaveText('Month 4');
  await expect(page.getByTestId('year-one')).toHaveText('+$30,250');
  await expect(page.getByTestId('payback-stat')).toHaveText('Month 4');
});

test('editing an input recalculates and marks the scenario as edited', async ({ page }) => {
  const after = page.locator('#proposedMinutesPerCompletion');
  await after.fill('9');
  await expect(cashFigure(page)).toHaveText('+$1,500');
  await expect(page.getByTestId('hours-figure')).toHaveText('+50 h');
  await expect(page.locator('[data-preset="flexible-contractor"]')).toContainText('Edited');
  await page.getByRole('button', { name: 'Reset to Flexible contractor' }).click();
  await expect(cashFigure(page)).toHaveText('+$3,500');
  await expect(after).toHaveValue('6');
});

test('invalid input keeps the last valid results and recovers', async ({ page }) => {
  const setup = page.locator('#setupCash');
  await setup.fill('');
  await expect(page.getByTestId('stale-banner')).toContainText('Fix 1 highlighted input');
  await expect(setup).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#setupCash-error')).toContainText('Blank is not treated as zero');
  await expect(cashFigure(page)).toHaveText('+$3,500');
  await page.getByRole('tab', { name: 'Scenario file and storage' }).click();
  await expect(page.getByTestId('export-button')).toBeDisabled();

  await setup.fill('abc');
  await expect(page.locator('#setupCash-error')).toContainText('plain number');
  await setup.fill('0');
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
  await expect(page.getByTestId('payback')).toHaveText('No initial investment to recover');
  await expect(page.getByTestId('payback-stat')).toHaveText('No initial investment to recover');
});

test('a cash reduction larger than the labour expense is rejected with a specific message', async ({ page }) => {
  await page.locator('#cashRatePerHour').fill('100');
  await expect(page.locator('#cashRatePerHour-error')).toContainText('more than the 8,000 you currently pay');
  await expect(cashFigure(page)).toHaveText('+$3,500');
});

test('extra human work shows as added hours and added cost', async ({ page }) => {
  await page.locator('#proposedMinutesPerCompletion').fill('15');
  await expect(page.getByTestId('hours-figure')).toHaveText('-50 h');
  await expect(cashFigure(page)).toHaveText('-$2,500');
  await expect(page.getByTestId('retained-hours')).toHaveText('0.0 h');
});

test('zero accepted completions leaves unit cost undefined', async ({ page }) => {
  await page.locator('#acceptedCompletionsPerMonth').fill('0');
  await expect(page.getByTestId('unit-cost-undefined')).toContainText('Undefined');
  await expect(cashFigure(page)).toHaveText('-$300');
});

test('future plan allocates only retained hours after its start month', async ({ page }) => {
  await page.locator('[data-preset="fixed-payroll"]').click();
  await page.getByRole('button', { name: 'Add a future plan' }).click();
  await expect(page.locator('#futurePlan\\.startMonth')).toBeFocused();
  await page.locator('#futurePlan\\.startMonth').fill('4');
  await page.locator('#futurePlan\\.hoursPerMonth').fill('80');
  await page.locator('#futurePlan\\.budgetPerMonth').fill('3200');
  await expect(page.getByTestId('plan-figure')).toHaveText('+$28,800');
  await expect(page.getByTestId('plan-covered')).toHaveText('80.0 h');
  // Current cash is untouched by the plan.
  await expect(cashFigure(page)).toHaveText('-$500');
  await expect(page.getByTestId('year-one')).toHaveText('-$7,200');

  await page.getByRole('tab', { name: 'Month by month' }).click();
  const table = page.getByTestId('month-table');
  await expect(table.locator('tbody tr').nth(1)).toContainText('before start');
  await expect(table.locator('tbody tr').nth(4)).toContainText('$3,200');

  // The contractor case monetises every freed hour, so nothing is left for the plan.
  await page.locator('[data-preset="flexible-contractor"]').click();
  await page.locator('#group-plan summary').click();
  await page.locator('#futurePlan\\.enabled').check();
  await page.locator('#futurePlan\\.hoursPerMonth').fill('80');
  await page.locator('#futurePlan\\.budgetPerMonth').fill('3200');
  await expect(page.getByTestId('plan-figure')).toHaveText('$0');
  await expect(page.getByTestId('plan-covered')).toHaveText('0.0 h');
});

test('valid edits survive a reload and the status says so', async ({ page }) => {
  await page.locator('#name').fill('Reload check');
  await page.locator('#fixedCashPerMonth').fill('800');
  await expect(cashFigure(page)).toHaveText('+$3,000');
  await expect(page.locator('.assumptions__status')).toContainText('Saved in this browser');
  await page.reload();
  await expect(page.locator('#name')).toHaveValue('Reload check');
  await expect(page.locator('#fixedCashPerMonth')).toHaveValue('800');
  await expect(cashFigure(page)).toHaveText('+$3,000');
  await expect(page.locator('.assumptions__status')).toContainText('Restored the scenario saved in this browser');

  await page.getByRole('tab', { name: 'Scenario file and storage' }).click();
  await page.getByTestId('forget-button').click();
  await expect(page.getByTestId('storage-status')).toContainText('Nothing saved in this browser now');
  await page.reload();
  await expect(page.locator('#fixedCashPerMonth')).toHaveValue('300');
  await expect(page.locator('.assumptions__status')).toContainText('Not saved yet');
});

test('an invalid draft is not persisted; the last valid scenario is what reloads', async ({ page }) => {
  await page.locator('#fixedCashPerMonth').fill('800');
  await expect(cashFigure(page)).toHaveText('+$3,000');
  await page.locator('#fixedCashPerMonth').fill('-1');
  await expect(page.locator('.assumptions__status')).toContainText('Not saved: fix 1 input');
  await page.reload();
  await expect(page.locator('#fixedCashPerMonth')).toHaveValue('800');
});

test('export downloads a versioned file that imports back; invalid files are rejected', async ({ page }) => {
  await page.locator('#name').fill('Export me');
  await page.locator('#setupCash').fill('9000');
  await page.getByRole('tab', { name: 'Scenario file and storage' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-button').click()]);
  expect(download.suggestedFilename()).toMatch(/^export-me-\d{4}-\d{2}-\d{2}\.olab\.json$/);
  const dir = mkdtempSync(join(tmpdir(), 'olab-'));
  const saved = join(dir, download.suggestedFilename());
  await download.saveAs(saved);
  const file = JSON.parse(readFileSync(saved, 'utf8'));
  expect(file.format).toBe('operating-leverage-lab-scenario');
  expect(file.version).toBe(1);
  expect(file.scenario.setupCash).toBe(9000);
  expect(file.scenario.name).toBe('Export me');
  await expect(page.getByTestId('scenario-message')).toContainText('Download started');

  // Change the page, then load the file back.
  await page.locator('#setupCash').fill('100');
  await expect(page.getByTestId('payback')).toHaveText('Month 1');
  await page.locator('#import-file').setInputFiles(saved);
  await expect(page.getByTestId('scenario-message')).toContainText('Loaded "Export me"');
  await expect(page.locator('#setupCash')).toHaveValue('9000');
  await expect(page.getByTestId('payback')).toHaveText('Month 3');

  // A syntactically valid but economically invalid file leaves everything untouched.
  const bad = { ...file, scenario: { ...file.scenario, cashRatePerHour: 500, name: '<script>alert(1)</script>' } };
  const badPath = join(dir, 'bad.json');
  writeFileSync(badPath, JSON.stringify(bad));
  await page.locator('#import-file').setInputFiles(badPath);
  await expect(page.getByTestId('scenario-message')).toContainText('was not loaded. The current scenario is unchanged');
  await expect(page.getByTestId('scenario-message')).toContainText('cashRatePerHour');
  await expect(page.locator('#setupCash')).toHaveValue('9000');
  await expect(page.locator('#name')).toHaveValue('Export me');

  const notJson = join(dir, 'notjson.json');
  writeFileSync(notJson, '{oops');
  await page.locator('#import-file').setInputFiles(notJson);
  await expect(page.getByTestId('scenario-message')).toContainText('Not valid JSON');

  // Imported text is rendered as text, never as markup.
  const textFile = { ...file, scenario: { ...file.scenario, name: '<b>bold</b>' } };
  const textPath = join(dir, 'text.json');
  writeFileSync(textPath, JSON.stringify(textFile));
  await page.locator('#import-file').setInputFiles(textPath);
  await expect(page.locator('#name')).toHaveValue('<b>bold</b>');
  await expect(page.getByTestId('scenario-message')).toContainText('Loaded "<b>bold</b>"');
  expect(await page.locator('[data-testid="scenario-message"] b').count()).toBe(0);
});

test('calculation detail and month table carry the arithmetic', async ({ page }) => {
  const calc = page.getByTestId('calc-table');
  await expect(calc).toContainText('Monthly net cash, full adoption');
  await expect(calc.locator('tr', { hasText: 'Cost per completion, after' })).toContainText('$4.50');
  await page.getByRole('tab', { name: 'Month by month' }).click();
  const rows = page.getByTestId('month-table').locator('tbody tr');
  await expect(rows.nth(0)).toContainText('-$7,000');
  await expect(rows.nth(2)).toContainText('$0');
  await expect(rows.last()).toContainText('Year one');
  await expect(rows.last()).toContainText('+$35,000');
});

test('keyboard: tabs use arrow keys and chart months are focusable', async ({ page }) => {
  const first = page.getByRole('tab', { name: 'Calculation detail' });
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Month by month' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Month by month' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Scenario file and storage' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();

  const hit = page.locator('.chart-frame rect.hit').nth(2);
  await hit.focus();
  await expect(page.getByTestId('chart-readout')).toContainText('Month 2: net +$3,500, cumulative $0');
});

test('every interactive control is reachable by Tab and inputs describe their errors', async ({ page }) => {
  await page.locator('#acceptedCompletionsPerMonth').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#baselineMinutesPerCompletion')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#proposedMinutesPerCompletion')).toBeFocused();
  await page.keyboard.type('x');
  await expect(page.locator('#proposedMinutesPerCompletion')).toHaveAttribute('aria-describedby', /proposedMinutesPerCompletion-error/);
  const skip = page.locator('.skip-link');
  await skip.focus();
  await expect(skip).toBeVisible();
});
