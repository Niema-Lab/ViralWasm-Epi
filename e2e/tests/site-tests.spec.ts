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
	const start = performance.now();
	await expect(page.getByTestId('output-text')).toHaveValue(/ViralMSA loaded./, { timeout: 30000 });
	console.log('Time to load: ' + (performance.now() - start));
});

test.afterEach(async ({ page }) => {
	expect(errors).toEqual([]);
});

test('run example data', async ({ page, browserName }) => {
	test.setTimeout(50000);
	await page.getByTestId('load-example-data').click();
	await page.getByTestId('run').click();

	await expect(page.getByTestId('output-text')).toHaveValue(/Time Elapsed:/, { timeout: 10000 });
	const timeElapsed = (await page.getByTestId('duration-text').textContent())?.replace(/[^0-9\.]/g, '') ?? '-1';
	await expect(parseFloat(timeElapsed)).toBeGreaterThan(0);
});