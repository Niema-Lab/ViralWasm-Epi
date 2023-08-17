importScripts("https://biowasm.com/cdn/v3/aioli.js")

let CLI;
let mm2FinishedBuffer;
let downloadResults = false;

const init = async () => {
	CLI = await new Aioli(["minimap2/2.22", "tn93/1.0.11"]);
}

init();

// listen for messages from main thread
self.onmessage = async (event) => {
	if (event.data.arraybuffer) {
		mm2FinishedBuffer = event.data.arraybuffer;
	} else if (event.data.writeIndex) {
		CLI.fs.writeFile("target.fas.mmi", event.data.writeIndex, { encoding: "binary" });
	} else if (event.data.runMinimap2) {
		runMinimap2(event.data.command, event.data.inputSeq, event.data.refSeq);
	} else if (event.data.runTN93) {
		runTN93(event.data.inputFile, event.data.command);
	} else if (event.data.getResults) {
		if (downloadResults) {
			self.postMessage({
				download: [
					['pairwise-distances.csv', await CLI.fs.readFile("pairwise-distances.csv", { encoding: "utf8" })],
				]
			})
		}
	}
}

// run minimap2 with provided command, sequences
const runMinimap2 = async (command, inputSeq, refSeq) => {
	downloadResults = false;
	// reset minimap2 output buffer
	mm2FinishedBuffer.fill(0);

	// build minimap2 index
	if (command.includes('-d')) {
		await CLI.mount([{
			name: "target.fas",
			data: inputSeq,
		}]);

		// run minimap2 in BioWASM
		self.postMessage({ log: '\nRunning command: ' + command.join(' ') + '\n\n' })
		await CLI.exec(command.join(' '));

		// send over output file data (minimap2 index)
		self.postMessage({ minimap2done: 'buildIndex', mmi: await CLI.fs.readFile("target.fas.mmi", { encoding: "binary" }) })

		// alignment
	} else if (command.includes('-a')) {
		// mount sequence.fas
		await CLI.mount([{
			name: "sequence.fas",
			data: refSeq,
		}]);

		// run minimap2 in BioWASM
		self.postMessage({ log: '\nRunning command: ' + command.join(' ') + '\n\n' })
		const output = await CLI.exec(command.join(' '));
		self.postMessage({ log: output })

		// send over output file data (sequence alignment / map file)
		self.postMessage({ minimap2done: 'alignment', sam: await CLI.fs.readFile("sequence.fas.sam", { encoding: "binary" }) })

		// cleanup
		await clearFiles();
	}
}

const runTN93 = async (inputFile, command) => {
	// mount input file
	await CLI.mount([{
		name: "input.fas",
		data: inputFile,
	}]);

	// create output file
	await CLI.fs.writeFile("pairwise-distances.csv", "", { encoding: "utf8" });

	// run tn93 in BioWASM
	self.postMessage({ log: '\nRunning command: ' + command + '\n\n' })
	const output = await CLI.exec(command);
	self.postMessage({ log: output })

	// send over output file data (tn93 output)
	self.postMessage({ tn93done: true })

	downloadResults = true;
}

const clearFiles = async () => {
	const files = await CLI.fs.readdir("./");
	for (const file of files) {
		if (file !== "." && file !== "..") {
			await CLI.fs.unlink(file);
			console.log(file);
		}
	}
}