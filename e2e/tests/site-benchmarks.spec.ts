import { test, expect } from '@playwright/test';
import fs from 'fs';

import { downloadFile, BENCHMARK_DIR, BENCHMARK_OUTPUT_DIR } from './constants';

const BENCHMARK_TESTS = ['100', '200', '400', '1000', '2000', '4000'];
const TEST_COUNT = 20;

for (let i = 1; i <= TEST_COUNT; i++) {
	for (const sequenceSize of BENCHMARK_TESTS) {
		test('run benchmark - ' + sequenceSize + ', run ' + i, async ({ page, browserName }) => {
			await runBenchmark(page, browserName, ['./e2e/data/' + sequenceSize + '.01.true.fas.gz'], './e2e/data/MT072688.fasta', sequenceSize + '.' + i + '/', parseInt(sequenceSize) * 150);
		});
	}
}

const runBenchmark = async (page, browserName: string, alignmentFiles: string[], referenceFile: string, downloadedLocation: string, runTimeout: number) => {
	test.setTimeout(runTimeout + 75000);
	await page.goto('/');
	await expect(page.getByTestId('output-text')).toHaveValue(/ViralMSA loaded./, { timeout: 30000 });
	await page.getByTestId('input-sequences').setInputFiles(alignmentFiles);
	await page.getByTestId('ref-sequence').setInputFiles(referenceFile);
	await page.getByTestId('run').click();

	await expect(page.getByTestId('output-text')).toHaveValue(/Time Elapsed:/, { timeout: runTimeout });
	
	const viralMSATimeOutputLine = (await page.getByTestId('output-text').inputValue()).split('\n').filter(line => line.includes('ViralMSA finished'))[0];
	const viralMSATimeElapsed = viralMSATimeOutputLine?.split(' ')?.slice(2)?.join('')?.replace(/[^0-9\.]/g, '') ?? '-1';
	const minimap2TimeOutputLine = (await page.getByTestId('output-text').inputValue()).split('\n').filter(line => line.includes('Minimap2 alignment finished'))[0];
	const minimap2TimeElapsed = minimap2TimeOutputLine?.split(' ')?.slice(2)?.join('')?.replace(/[^0-9\.]/g, '') ?? '-1';

	const timeElapsed = (await page.getByTestId('duration-text').textContent()).replace(/[^0-9\.]/g, '');
	await expect(parseFloat(timeElapsed)).toBeGreaterThan(0);

	await expect(page.getByTestId('output-text')).toHaveValue(/Estimated Peak Memory/, { timeout: 30000 });
	const memoryLine = (await page.getByTestId('output-text').inputValue()).split('\n').filter(line => line.includes('Estimated Peak Memory'))[0];
	let peakMemory = parseFloat(memoryLine?.split(' ')?.slice(2)?.join('')?.replace(/[^0-9\.]/g, '') ?? '-1') * 1000;
	
	await downloadFile(page, 'Download Alignment', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');
	
	if (!fs.existsSync(BENCHMARK_DIR + downloadedLocation + browserName)) {
		fs.mkdirSync(BENCHMARK_DIR + downloadedLocation + browserName, { recursive: true });
	}
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/viralmsa_time.log', viralMSATimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/minimap2_time.log', minimap2TimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/time.log', timeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/memory.log', '' + peakMemory);

	console.log(downloadedLocation);
	console.log('Time elapsed: ' + timeElapsed);
	console.log('Peak memory: ' + peakMemory);
}