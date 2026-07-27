import { test, expect } from '@playwright/test';

let errors: string[] = [];

test.beforeEach(async ({ page }, testInfo) => {
	// Marker that should appear in the GitHub Actions log.
	console.log('Using site-tests diagnostics v2');

	// Total time available to this hook and the associated test.
	testInfo.setTimeout(150_000);

	errors = [];

	page.on('console', (message) => {
		const line = `[browser:${message.type()}] ${message.text()}`;
		console.log(line);

		if (message.type() === 'error') {
			errors.push(line);
		}
	});

	page.on('pageerror', (error) => {
		const line = `[pageerror] ${error.stack ?? error.message}`;
		console.error(line);
		errors.push(line);
	});

	page.on('requestfailed', (request) => {
		console.error(
			`[requestfailed] ${request.method()} ${request.url()} - ` +
			`${request.failure()?.errorText ?? 'unknown failure'}`,
		);
	});

	page.on('response', (response) => {
		if (response.status() >= 400) {
			console.error(`[http ${response.status()}] ${response.url()}`);
		}
	});

	const response = await page.goto('/', {
		waitUntil: 'domcontentloaded',
	});

	if (response === null) {
		throw new Error('page.goto("/") returned no main-document response');
	}

	console.log(
		`[main-document] HTTP ${response.status()} ${response.url()}`,
	);

	if (!response.ok()) {
		throw new Error(
			`GET ${response.url()} returned HTTP ${response.status()}`,
		);
	}

	const start = performance.now();

	try {
		await expect(page.getByTestId('output-text')).toHaveValue(
			/ViralMSA loaded\./,
			{ timeout: 120_000 },
		);
	} catch (error) {
		console.error(`Current URL: ${page.url()}`);
		console.error(`Page title: ${await page.title()}`);

		await testInfo.attach('page.html', {
			body: await page.content(),
			contentType: 'text/html',
		});

		throw error;
	}

	console.log(`Time to load: ${performance.now() - start} ms`);
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
