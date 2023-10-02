export const BENCHMARK_DIR = 'benchmarks/';
export const BENCHMARK_OUTPUT_DIR = 'benchmark-run-outputs/';
export const downloadFile = async (page, identifier: string, location: string) => {
	const downloadPromise = page.waitForEvent('download');
	await page.getByText(identifier).click();
	const download = await downloadPromise;
	await download.saveAs(location + download.suggestedFilename());
}