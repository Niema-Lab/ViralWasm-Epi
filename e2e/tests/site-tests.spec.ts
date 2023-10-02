import { test, expect } from '@playwright/test';

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
	errors = [];
	page.on('console', msg => {
		if (msg.type() === 'error') {
			console.log(msg.text());
			errors.push(msg.text());
		}
	})

	await page.goto('/');
	await expect(page.getByTestId('output-text')).toHaveValue(/ViralMSA loaded./);
});

test.afterEach(async ({ page }) => {
	expect(errors).toEqual([]);
});

test('run example data', async ({ page, browserName }) => {
	test.setTimeout(15000);
	await page.getByTestId('load-example-data').click();
	await page.getByTestId('run').click();

	await expect(page.getByTestId('output-text')).toHaveValue(/Done! Time Elapsed:/, { timeout: 10000 });
	const timeElapsed = (await page.getByTestId('duration-text').textContent())?.replace(/[^0-9\.]/g, '') ?? '-1';
	await expect(parseFloat(timeElapsed)).toBeGreaterThan(0);
});