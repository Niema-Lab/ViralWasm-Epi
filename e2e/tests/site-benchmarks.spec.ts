import { test, expect } from '@playwright/test';
import fs from 'fs';

import { downloadFile, BENCHMARK_DIR, BENCHMARK_OUTPUT_DIR} from './constants';

const BENCHMARK_TESTS = ['100', '200', '400', '1000', '2000', '4000'];
const RUN_COUNT = 10;

for (let i = 1; i <= RUN_COUNT; i++) {
	for (const sequenceSize of BENCHMARK_TESTS) {
		test('run benchmark - ' + sequenceSize + ', run ' + i, async ({ page, browserName }) => {
			await runBenchmark(page, browserName, ['./e2e/data/' + sequenceSize + '.fas.sam'], './e2e/data/MT072688.fasta', sequenceSize + '.' + i + '/', parseInt(sequenceSize) * 150);
		});
	}
}

const runBenchmark = async (page, browserName: string, alignmentFiles: string[], referenceFile: string, downloadedLocation: string, runTimeout: number) => {
	test.setTimeout(runTimeout + 45000);
	await page.goto('/');
	await expect(page.getByTestId('output-text')).toHaveValue(/ViralMSA loaded./, { timeout: 30000 });
	await page.getByTestId('input-sequences').setInputFiles(alignmentFiles);
	await page.getByTestId('ref-sequence').setInputFiles(referenceFile);
	await page.getByTestId('run').click();

	await expect(page.getByTestId('output-text')).toHaveValue(/Done! Time Elapsed:/, { timeout: runTimeout });
	const timeOutputLine = (await page.getByTestId('output-text').inputValue()).split('\n').filter(line => line.includes('ViralMSA finished'))[0];
	const timeElapsed = timeOutputLine?.split(' ')?.slice(2)?.join('')?.replace(/[^0-9\.]/g, '') ?? '-1';
	await expect(parseFloat(timeElapsed)).toBeGreaterThan(0);
	await downloadFile(page, 'Download Alignment', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');

	if (!fs.existsSync(BENCHMARK_DIR + downloadedLocation + browserName)){
		fs.mkdirSync(BENCHMARK_DIR + downloadedLocation + browserName, { recursive: true });
	}
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/time.log', timeElapsed);
	console.log(downloadedLocation);
	console.log(timeElapsed);
}