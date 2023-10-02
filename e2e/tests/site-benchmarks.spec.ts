import { test, expect } from '@playwright/test';
import fs from 'fs';

import { downloadFile, BENCHMARK_DIR} from './constants';

const BENCHMARK_TESTS = {
	'example': {
		alignmentFiles: ['./e2e/data/example_hiv.fas'], 
		referenceFile: './e2e/data/NC_001802.fas', 
		outputFolder: 'example/',
		timeout: 10000
	},
	'400': {
		alignmentFiles: ['./e2e/data/400.01.true.fas'],
		referenceFile: './e2e/data/MT072688.fasta',
		outputFolder: '400/',
		timeout: 60000
	},
	'4000': {
		alignmentFiles: ['./e2e/data/4000.01.true.fas'],
		referenceFile: './e2e/data/MT072688.fasta',
		outputFolder: '4000/',
		timeout: 180000
	},
}

for (const [name, { referenceFile, alignmentFiles, outputFolder, timeout }] of Object.entries(BENCHMARK_TESTS)) {
	test('run benchmark - ' + name, async ({ page, browserName }) => {
		await runBenchmark(page, browserName, alignmentFiles, referenceFile, outputFolder, timeout);
	});
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
	await downloadFile(page, 'Download Alignment', BENCHMARK_DIR + downloadedLocation + browserName + '/');
	fs.appendFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/' + '/time.log', timeElapsed);
}