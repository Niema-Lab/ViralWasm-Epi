import { test, expect } from '@playwright/test';
import fs from 'fs';

import { downloadFile, BENCHMARK_DIR, BENCHMARK_OUTPUT_DIR } from './constants';

const BENCHMARK_TESTS = ['100', '200', '300'];
const TEST_COUNT = 5;

for (let i = 1; i <= TEST_COUNT; i++) {
	for (const sequenceSize of BENCHMARK_TESTS) {
		test('run benchmark - ' + sequenceSize + ', run ' + i, async ({ page, browserName }) => {
			await runBenchmark(
				page,
				browserName,
				['./e2e/data/' + sequenceSize + '.' + String(i).padStart(2, '0') + '.seqs.fas.gz'],
				'./e2e/data/NC_001802.fas',
				'./e2e/data/' + sequenceSize + '.' + String(i).padStart(2, '0') + '.dates.txt',
				sequenceSize + '.' + String(i).padStart(2, '0') + '/',
				parseInt(sequenceSize) * 600);
		});
	}
}

const runBenchmark = async (page, browserName: string, alignmentFiles: string[], referenceFile: string, dateFile: string, downloadedLocation: string, runTimeout: number) => {
	test.setTimeout(runTimeout + 75000);
	await page.goto('/');
	await expect(page.getByTestId('output-text')).toHaveValue(/ViralMSA loaded./, { timeout: 30000 });
	await page.getByTestId('input-sequences').setInputFiles(alignmentFiles);
	await page.getByTestId('ref-sequence').setInputFiles(referenceFile);
	await page.getByTestId('molecular-clustering-check').check();
	await page.getByTestId('phylo-inference-check').check();
	await page.getByTestId('lsd2-check').check();
	await page.getByTestId('lsd2-date-file').setInputFiles(dateFile);
	await page.getByTestId('run').click();

	await expect(page.getByTestId('output-text')).toHaveValue(/Time Elapsed:/, { timeout: runTimeout });

	const viralMSATimeElapsed = await getTimeElapsed(page, 'ViralMSA finished');
	const minimap2TimeElapsed = await getTimeElapsed(page, 'Minimap2 alignment finished');
	const tn93TimeElapsed = await getTimeElapsed(page, 'tn93 finished');
	const fasttreeTimeElapsed = await getTimeElapsed(page, 'FastTree finished');
	const lsd2TimeElapsed = await getTimeElapsed(page, 'LSD2 finished');

	const timeElapsed = (await page.getByTestId('duration-text').textContent()).replace(/[^0-9\.]/g, '');
	await expect(parseFloat(timeElapsed)).toBeGreaterThan(0);

	await expect(page.getByTestId('output-text')).toHaveValue(/Estimated Peak Memory/, { timeout: 30000 });
	const memoryLine = (await page.getByTestId('output-text').inputValue()).split('\n').filter(line => line.includes('Estimated Peak Memory'))[0];
	let peakMemory = Math.round(parseFloat(memoryLine?.split(' ')?.slice(2)?.join('')?.replace(/[^0-9\.]/g, '') ?? '-1') * 1000);

	await downloadFile(page, 'Download Alignment', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');
	await downloadFile(page, 'Download Pairwise Distances', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');
	await downloadFile(page, 'Download Clusters', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');
	await downloadFile(page, 'Download Phylogenetic Tree', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');
	await downloadFile(page, 'Download LSD2 Results', BENCHMARK_OUTPUT_DIR + downloadedLocation + browserName + '/');

	fs.mkdirSync(BENCHMARK_DIR + downloadedLocation + browserName, { recursive: true });
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/viralmsa_time.log', viralMSATimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/minimap2_time.log', minimap2TimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/tn93_time.log', tn93TimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/fasttree_time.log', fasttreeTimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/lsd2_time.log', lsd2TimeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/time.log', timeElapsed);
	fs.writeFileSync(BENCHMARK_DIR + downloadedLocation + browserName + '/memory.log', '' + peakMemory);

	console.log(downloadedLocation);
	console.log('Time elapsed: ' + timeElapsed);
	console.log('Peak memory: ' + peakMemory);
}

const getTimeElapsed = async (page, filter: string) => {
	const outputLine = (await page.getByTestId('output-text').inputValue()).split('\n').filter(line => line.includes(filter))[0];
	return outputLine?.split(' ')?.slice(2)?.join('')?.replace(/[^0-9\.]/g, '') ?? '-1';
}