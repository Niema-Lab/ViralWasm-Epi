// TODO: 300 seq timing out
// TODO: speed up load time / run time
// TODO: incorporate gzip wherever and optimize memory usage
// TODO: implement manual reinit
import React, { Component, Fragment } from 'react'
import { marked } from 'marked'
import JSZip from 'jzip';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import './App.scss'
import loadingCircle from './assets/loading.png'

import {
	OUTPUT_ID,
	CLEAR_LOG,
	GET_TIME_WITH_MILLISECONDS,
	OFFLINE_INSTRUCTIONS,
	OFFLINE_INSTRUCTIONS_KEYWORDS,
	VIRAL_MSA_REPO_STRUCTURE_LINK,
	EXAMPLE_INPUT_FILE,
	EXAMPLE_PRELOADED_REF,
	DEFAULT_INPUT_STATE,
	VIRAL_MSA_REF_GENOMES_DIR,
	VIRAL_MSA_LINK,
	VIRAL_MSA_WEB_LINK,
	MINIMAP2_VERSION,
	TN93_VERSION,
	FASTTREE_VERSION,
	LSD2_VERSION,
	PATH_TO_PYODIDE_ROOT,
	FASTTREE_OUTPUT_FILE,
	SED_VERSION,
	SEQTK_VERSION,
	INPUT_ALN_FILE
} from './constants.js';

export class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			showOfflineInstructions: false,
			offlineInstructions: undefined,
			REFS: undefined,
			REF_NAMES: undefined,
			viralMSAVersion: undefined,
			ViralMSAWeb: undefined,
			refGenomes: new Set(),
			exampleInput: undefined,
			preloadRefOptions: undefined,

			...DEFAULT_INPUT_STATE,

			CLI: undefined,
			pyodide: undefined,

			clusteringData: undefined,
			tn93OutputFile: undefined,

			peakMemory: 0,
			startTime: new Date().getTime(),
			timeElapsed: undefined,
			running: false,
			done: false,
			inputChanged: false,

			viralMSADownloadResults: false,
			biowasmDownloadResults: false,
			downloadAlignment: false,
			downloadPairwise: false,
			downloadTree: false,
			downloadLSD2: false,

			siteReady: false,
			expandedContainer: undefined,
			outputAutoscroll: true,
		}
	}

	async componentDidMount() {
		this.initPyodide();
		this.initBiowasm();

		// Other initialization
		this.disableNumberInputScroll();
		this.fetchPreloadedRef();
		this.initPreloadedRefs();
		this.fetchExampleInput();
		this.fetchOfflineInstructions();
		this.addOfflineInstructionsListener();
	}

	setStatePromise = (newState) => {
		return new Promise((resolve) => {
			this.setState(newState, resolve);
		});
	}

	initBiowasm = async () => {
		this.setState({
			CLI: await new window.Aioli([
				{
					tool: "minimap2",
					version: MINIMAP2_VERSION,
					urlPrefix: `${window.location.origin}${import.meta.env.BASE_URL || ''}tools/minimap2`,
				}, {
					tool: "tn93",
					version: TN93_VERSION,
					urlPrefix: `${window.location.origin}${import.meta.env.BASE_URL || ''}tools/tn93`,
				}, {
					tool: "fasttree",
					version: FASTTREE_VERSION,
					urlPrefix: `${window.location.origin}${import.meta.env.BASE_URL || ''}tools/fasttree`,
				}, {
					tool: "lsd2",
					version: LSD2_VERSION,
					urlPrefix: `${window.location.origin}${import.meta.env.BASE_URL || ''}tools/lsd2`,
				}, {
					tool: "sed",
					version: SED_VERSION,
					reinit: true,
					urlPrefix: `${window.location.origin}${import.meta.env.BASE_URL || ''}tools/sed`,
				}, {
					tool: "seqtk",
					version: SEQTK_VERSION,
					urlPrefix: `${window.location.origin}${import.meta.env.BASE_URL || ''}tools/seqtk`,
				}], {
				printInterleaved: false,
				printStream: true,
				callback: (msg) => msg.stderr && this.log(msg.stderr + '\n', false),
			})
		}, async () => {
			this.log('Biowasm loaded.');
		})
	}

	initPyodide = async () => {
		// load pyodide
		const pyodide = await loadPyodide({
			stdout: (text) => {
				this.log("STDOUT: " + text + "\n", false)
			},
			stderr: (text) => {
				this.log("STDERR: " + text + "\n", false)
			},
		});
		this.setState({ pyodide })

		// create cache directory for ViralMSA sequences and indexes 
		pyodide.FS.mkdir(PATH_TO_PYODIDE_ROOT + 'cache');

		// load in ViralMSA.py
		pyodide.FS.writeFile(PATH_TO_PYODIDE_ROOT + 'ViralMSA.py', await (await fetch(`${import.meta.env.BASE_URL || ''}${VIRAL_MSA_LINK}`)).text(), { encoding: "utf8" });

		// load in ViralMSAWeb.py
		const ViralMSAWeb = await (await fetch(`${import.meta.env.BASE_URL || ''}${VIRAL_MSA_WEB_LINK}`)).text()

		// get REFS and REF_NAMES for preloaded reference sequences and indexes
		pyodide.runPython(ViralMSAWeb)
		const REFS = pyodide.globals.get('REFS').toJs()
		const REF_NAMES = pyodide.globals.get('REF_NAMES').toJs()
		// done loading pyodide / ViralMSA 
		this.setState({ ViralMSAWeb, REFS, REF_NAMES, viralMSAVersion: ' v' + pyodide.globals.get('VERSION'), siteReady: true })
		this.log("ViralMSA loaded.")
	}

	disableNumberInputScroll = () => {
		document.addEventListener("wheel", () => {
			if (document.activeElement.type === "number") {
				document.activeElement.blur();
			}
		});
	}

	fetchPreloadedRef = async () => {
		const res = await fetch(`${import.meta.env.BASE_URL || ''}${VIRAL_MSA_REPO_STRUCTURE_LINK}`);
		const json = await res.json();
		const refGenomes = new Set();
		for (const file of json.tree) {
			if (file.path.startsWith("ref_genomes/")) {
				refGenomes.add(file.path.split("/")[1]);
			}
		}
		this.setState({ refGenomes });
	}

	initPreloadedRefs = () => {
		const preloadRefInterval = setInterval(() => {
			if (this.state.REFS && this.state.REF_NAMES && this.state.refGenomes.size > 0) {
				clearInterval(preloadRefInterval);
				const preloadRefOptions = [];
				for (const REF_NAME_MAP of this.state.REF_NAMES) {
					const REF_NAME_MAP_TYPE = [...REF_NAME_MAP[1]]
					for (const REF_NAME of REF_NAME_MAP_TYPE) {
						const virus = REF_NAME[0];
						const commonName = REF_NAME[1];
						preloadRefOptions.push(
							<option value={this.state.REFS.get(virus)} key={commonName}>{commonName}</option>
						)
					}
				}

				preloadRefOptions.sort((a, b) => a.key.localeCompare(b.key));
				this.setState({ preloadRefOptions })
			}
		}, 250)
	}

	fetchExampleInput = async () => {
		this.setState({
			exampleInput: await (await fetch(`${import.meta.env.BASE_URL || ''}${EXAMPLE_INPUT_FILE}`)).text()
		})
	}

	fetchOfflineInstructions = async () => {
		const res = await fetch(`${window.location.origin}${import.meta.env.BASE_URL || ''}${OFFLINE_INSTRUCTIONS}`);
		const text = await res.text();
		const html = marked(text);
		const offlineInstructions = html.slice(html.indexOf(OFFLINE_INSTRUCTIONS_KEYWORDS) + OFFLINE_INSTRUCTIONS_KEYWORDS.length)
		this.setState({ offlineInstructions });
	}

	addOfflineInstructionsListener = () => {
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				this.hideOfflineInstructions();
			}
		})
	}

	pyodideRunViralMSA = async (inputSamData, refSeq, omitRef) => {
		const pyodide = this.state.pyodide;

		// reset global variable
		this.setState({ viralMSADownloadResults: false })

		await this.pyodideClearFiles();

		// write provided files to Pyodide
		const transferTime = performance.now();
		this.log('\n', false)
		this.log('Transferring files to Pyodide for ViralMSA...')
		pyodide.FS.writeFile(PATH_TO_PYODIDE_ROOT + 'reference.fas', refSeq, { encoding: "utf8" });
		pyodide.FS.writeFile(PATH_TO_PYODIDE_ROOT + 'sequence.fas.sam', inputSamData, { encoding: "utf8" });
		this.log(`Transferred files in ${((performance.now() - transferTime) / 1000).toFixed(3)} seconds`)

		let args = "./ViralMSA.py -e email@address.com -s sequence.fas.sam -o output -r reference.fas --viralmsa_dir cache";

		if (omitRef) {
			args += " --omit_ref";
		}

		this.log('\nRunning command: ' + args + "\n\n", false)
		pyodide.globals.set("arguments", args);

		// run ViralMSAWeb.py
		const viralMSAStartTime = performance.now();
		pyodide.runPython(this.state.ViralMSAWeb);

		// after finished
		this.log('\n', false)
		this.log(`ViralMSA finished in ${((performance.now() - viralMSAStartTime) / 1000).toFixed(3)} seconds\n`)
		this.setState({ viralMSADownloadResults: true, downloadAlignment: true })

		await this.pyodideClearFiles(false);
	}

	pyodideClearFiles = async (removeAln = true) => {
		const pyodide = this.state.pyodide;

		// remove sequence.fas.sam
		if (pyodide.FS.readdir(PATH_TO_PYODIDE_ROOT).includes('sequence.fas.sam')) {
			pyodide.FS.unlink(PATH_TO_PYODIDE_ROOT + 'sequence.fas.sam');
		}

		// remove reference.fas
		if (pyodide.FS.readdir(PATH_TO_PYODIDE_ROOT).includes('reference.fas')) {
			pyodide.FS.unlink(PATH_TO_PYODIDE_ROOT + 'reference.fas');
		}

		// remove output folder
		if (pyodide.FS.readdir(PATH_TO_PYODIDE_ROOT).includes('output')) {
			for (const file of pyodide.FS.readdir(PATH_TO_PYODIDE_ROOT + 'output')) {
				if (file === '.' || file === '..' || (file === 'sequence.fas.sam.aln' && !removeAln)) continue;
				pyodide.FS.unlink(PATH_TO_PYODIDE_ROOT + 'output/' + file)
			}
			if (removeAln) {
				pyodide.FS.rmdir(PATH_TO_PYODIDE_ROOT + 'output', true);
			}
		}
	}

	// run minimap2 with provided command, sequences
	runMinimap2 = async (command, inputSeq, refSeq, isGZIP) => {
		const CLI = this.state.CLI;
		this.setState({ biowasmDownloadResults: false })

		await CLI.mount([{
			name: "ref.fas",
			data: refSeq,
		}]);

		// alignment
		if (isGZIP) {
			await CLI.fs.writeFile("sequence.fas.gz", new Uint8Array(inputSeq), { encoding: "binary" });
		} else {
			await CLI.fs.writeFile("sequence.fas", inputSeq, { encoding: "utf8" });
		}

		// run minimap2 in BioWASM
		this.log('\n', false);
		this.log('Aligning sequences...')
		this.log('Running command: ' + command + '\n')

		const minimap2StartTime = performance.now();
		this.log((await CLI.exec(command)).stderr, false);
		this.log('\n', false);
		this.log(`Minimap2 alignment finished in ${((performance.now() - minimap2StartTime) / 1000).toFixed(3)} seconds`)

		// set file data (sequence alignment / map file)
		return await CLI.fs.readFile("sequence.fas.sam", { encoding: "utf8" });
	}

	biowasmClearFiles = async () => {
		const CLI = this.state.CLI;
		const files = await CLI.fs.readdir("./");
		for (const file of files) {
			if (file !== "." && file !== "..") {
				await CLI.fs.truncate(file, 0);
			}
		}
	}

	setInputFile = (event) => {
		this.setState({ useExampleInput: false, inputFile: event.target.files[0], validInputFile: true, inputChanged: true })
	}

	setPreloadedRef = (event) => {
		this.setState({ preloadedRef: event.target.value === 'undefined' ? undefined : event.target.value, validRefFile: event.target.value !== 'undefined', inputChanged: true })
	}

	setRefFile = (event) => {
		this.setState({ refFile: event.target.files[0], inputChanged: true, validRefFile: true })
	}

	clearRefFile = () => {
		if (this.state.refFile !== undefined) {
			this.setState({ inputChanged: true })
		}
		this.setState({ refFile: undefined, validRefFile: true })
		document.getElementById('ref-sequence').value = null;
	}

	toggleSkipAlignment = () => {
		this.setState(prevState => ({ skipAlignment: !prevState.skipAlignment, inputChanged: true }))
	}

	toggleOmitRef = () => {
		this.setState(prevState => ({ omitRef: !prevState.omitRef, inputChanged: true }))
	}

	setThreshold = (event) => {
		this.setState({ threshold: event.target.value, inputChanged: true, validThreshold: event.target.value >= 0 && event.target.value <= 1, validClusterThreshold: this.state.clusterThreshold >= 0 && this.state.clusterThreshold <= 1 && this.state.clusterThreshold <= event.target.value })
	}

	setAmbigs = (event) => {
		this.setState({ ambigs: event.target.value, inputChanged: true })
	}

	setAmbigsString = (event) => {
		this.setState({ ambigsString: event.target.value, inputChanged: true })
	}

	setFraction = (event) => {
		this.setState({ fraction: event.target.value, inputChanged: true, validFraction: event.target.value >= 0 && event.target.value <= 1 })
	}

	setFormat = (event) => {
		this.setState({ format: event.target.value, inputChanged: true })
	}

	setOverlap = (event) => {
		this.setState({ overlap: event.target.value, inputChanged: true, validOverlap: event.target.value >= 1 || event.target.value === "" })
	}

	setCounts = (event) => {
		this.setState({ counts: event.target.value, inputChanged: true, validCounts: event.target.value.length <= 1 })
	}

	setProbability = (event) => {
		this.setState({ probability: event.target.value, inputChanged: true, validProbability: event.target.value >= 0 && event.target.value <= 1 })
	}

	setBootstrap = (event) => {
		this.setState({ bootstrap: event.target.checked, inputChanged: true })
	}

	setBootstrapAcrossSites = (event) => {
		this.setState({ bootstrapAcrossSites: event.target.checked, inputChanged: true })
	}

	setCountFlag = (event) => {
		if (event.target.checked) {
			this.setFormat({
				target: { value: "tsv" }
			})
		}

		this.setState({ countFlag: event.target.checked, inputChanged: true })
	}

	setCompute = (event) => {
		this.setState({ compute: event.target.checked, inputChanged: true })
	}

	setSelfDistance = (event) => {
		this.setState({ selfDistance: event.target.checked, inputChanged: true })
	}

	toggleMolecularClusteringArgs = () => {
		this.setState(prevState => ({ performMolecularClustering: !prevState.performMolecularClustering, inputChanged: true }))
	}

	setClusterThreshold = (event) => {
		this.setState({ clusterThreshold: event.target.value, inputChanged: true, validClusterThreshold: event.target.value >= 0 && event.target.value <= 1 && event.target.value <= this.state.threshold })
	}

	togglePhyloInferenceArgs = () => {
		this.setState(prevState => ({ performPhyloInference: !prevState.performPhyloInference, performLSD2: !prevState.performPhyloInference && prevState.performLSD2, inputChanged: true }))
	}

	toggleGtrModel = () => {
		this.setState(prevState => ({ gtrModel: !prevState.gtrModel, inputChanged: true }))
	}

	toggleGammaLikelihoods = () => {
		this.setState(prevState => ({ gammaLikelihoods: !prevState.gammaLikelihoods, inputChanged: true }))
	}

	toggleLSD2 = () => {
		this.setState(prevState => ({ performLSD2: !prevState.performLSD2, inputChanged: true }))
	}

	setLSD2DateFile = (event) => {
		this.setState({ LSD2DateFile: event.target.files[0], validLSD2DateFile: true, inputChanged: true })
	}

	setLSD2OutgroupFile = (event) => {
		this.setState({ LSD2OutgroupFile: event.target.files[0], inputChanged: true })
	}

	toggleRemoveOutgroups = () => {
		this.setState(prevState => ({ removeOutgroups: !prevState.removeOutgroups, inputChanged: true }))
	}

	toggleInferRoot = () => {
		this.setState(prevState => ({ inferRoot: !prevState.inferRoot, inputChanged: true }))
	}

	setRootDate = (event) => {
		this.setState({ rootDate: event.target.value, inputChanged: true })
	}

	setNullBranchLength = (event) => {
		this.setState({ nullBranchLength: event.target.value, inputChanged: true })
	}

	setMinBranchLength = (event) => {
		this.setState({ minBranchLength: event.target.value, inputChanged: true, validMinBranchLength: event.target.value >= 0 })
	}

	setStdDevRelaxedClock = (event) => {
		this.setState({ stdDevRelaxedClock: event.target.value, inputChanged: true, validStdDevRelaxedClock: event.target.value >= 0 })
	}

	setRoundTime = (event) => {
		this.setState({ roundTime: event.target.value, inputChanged: true, validRoundTime: event.target.value >= 0 })
	}

	setRateLowerBound = (event) => {
		this.setState({ rateLowerBound: event.target.value, inputChanged: true, validRateLowerBound: event.target.value >= 0 })
	}

	setLSD2Variance = (event) => {
		this.setState({ LSD2Variance: event.target.value, inputChanged: true })
	}

	toggleExampleData = () => {
		if (!this.state.useExampleInput) {
			document.getElementById('ref-sequence').value = null;
		}

		this.setState(prevState => ({
			useExampleInput: !prevState.useExampleInput,
			validInputFile: prevState.useExampleInput ? prevState.validInputFile : true,
			preloadedRef: prevState.useExampleInput ? prevState.preloadedRef : EXAMPLE_PRELOADED_REF,
			refFile: prevState.useExampleInput ? prevState.refFile : undefined,
			validRefFile: prevState.useExampleInput ? prevState.validRefFile : true,
			inputChanged: true,
		}))
	}

	promptResetInput = () => {
		if (window.confirm("Are you sure you want to reset? All input data will be lost.")) {
			this.resetInput();
		}
	}

	resetInput = () => {
		this.setState(Object.assign({ inputChanged: true }, DEFAULT_INPUT_STATE));
		document.getElementById('input-sequences').value = null;
		document.getElementById('ref-sequence').value = null;
	}

	runViralEpi = async () => {
		const pyodide = this.state.pyodide;

		// validation
		if (this.state.skipAlignment && this.state.useExampleInput) {
			alert('Cannot skip alignment when using example data.');
			return;
		}

		let valid = true;
		if (!this.state.useExampleInput && this.state.inputFile === undefined) {
			this.setState({ validInputFile: false })
			valid = false;
		}

		if (!this.state.useExampleInput && !this.state.preloadedRef && this.state.refFile === undefined) {
			this.setState({ validRefFile: false })
			valid = false;
		}

		if (this.state.performMolecularClustering && !this.validTN93()) {
			valid = false;
		}

		if (this.state.performLSD2 && !this.validLSD2()) {
			valid = false;
		}

		if (!valid) {
			alert("Invalid input. Please check your input and try again.")
			this.log("Invalid input. Please check your input and try again.")
			return;
		}

		// scroll to top
		window.scrollTo({
			top: window.innerHeight / 4,
			left: 0,
			behavior: 'instant'
		});
		await this.biowasmClearFiles();
		CLEAR_LOG();

		this.setState({ running: true, done: false, inputChanged: false, timeElapsed: undefined, startTime: new Date().getTime(), downloadAlignment: false, downloadPairwise: false, downloadTree: false, downloadLSD2: false, clusteringData: undefined })

		let inputAln = undefined;
		if (this.state.skipAlignment) {
			inputAln = await this.fileReaderReadFile(this.state.inputFile);
		} else {
			await this.runViralMSA();
			inputAln = pyodide.FS.readFile(PATH_TO_PYODIDE_ROOT + "output/sequence.fas.sam.aln", { encoding: "utf8" });
		}

		if (this.state.performMolecularClustering || this.state.performPhyloInference || this.state.performLSD2) {
			// mount alignment file
			await this.state.CLI.mount([{
				name: INPUT_ALN_FILE,
				data: inputAln,
			}]);
		}

		if (this.state.performMolecularClustering) {
			await this.runTN93();
		}
		if (this.state.performPhyloInference) {
			await this.runFasttree();
		}
		if (this.state.performLSD2) {
			await this.runLSD2();
		}
		const timeElapsed = (new Date().getTime() - this.state.startTime) / 1000;
		this.setState({ done: true, timeElapsed })
		this.log(`Done!`);
		this.log(`Time Elapsed: ${timeElapsed.toFixed(3)} seconds`);
		this.log(`Estimated Peak Memory: ${(await this.getMemory() / 1000000).toFixed(3)} MB`);
	}

	runViralMSA = async () => {
		// further validation
		if (this.state.preloadedRef === undefined && this.state.refFile === undefined) {
			alert("Please select a reference sequence file.");
			return;
		}

		// validation passed
		// clear console and runtime record
		CLEAR_LOG();

		let inputSeq;
		let refSeq;
		let isSAM;
		let isGZIP;

		const readStartTime = performance.now();
		this.log("Reading input sequence file...")
		if (this.state.useExampleInput) {
			inputSeq = this.state.exampleInput;
			isSAM = false;
		} else {
			isSAM = this.state.inputFile.name.toLowerCase().endsWith('.sam');
			isGZIP = this.state.inputFile.name.toLowerCase().endsWith('.gz');
			inputSeq = await this.fileReaderReadFile(this.state.inputFile, isGZIP);
		}

		if (this.state.refFile) {
			refSeq = await this.fileReaderReadFile(this.state.refFile);
		} else {
			// only need to provide refID when using a preloaded reference sequence and index
			refSeq = await (await fetch(`${import.meta.env.BASE_URL || ''}${VIRAL_MSA_REF_GENOMES_DIR}` + this.state.preloadedRef + "/" + this.state.preloadedRef + ".fas")).text();
		}
		this.log(`Read input sequence file in ${((performance.now() - readStartTime) / 1000).toFixed(3)} seconds`)

		if (isSAM) {
			await this.pyodideRunViralMSA(inputSeq, refSeq, this.state.omitRef);
		} else {
			const samFileData = await this.runMinimap2('minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o sequence.fas.sam ref.fas sequence.fas' + (isGZIP ? ".gz" : ""), inputSeq, refSeq, isGZIP);
			await this.biowasmClearFiles();
			await this.pyodideRunViralMSA(samFileData, refSeq, this.state.omitRef);
		}
	}

	validTN93 = () => {
		return this.state.validThreshold && this.state.validFraction && this.state.validOverlap && this.state.validCounts && this.state.validProbability && this.state.validClusterThreshold;
	}

	validLSD2 = () => {
		let validLSD2DateFile = true;
		if (this.state.LSD2DateFile === undefined) {
			validLSD2DateFile = false;
		}

		this.setState({ validLSD2DateFile })
		return validLSD2DateFile && this.state.validMinBranchLength && this.state.validStdDevRelaxedClock && this.state.validRoundTime && this.state.validRateLowerBound;
	}

	runTN93 = async () => {
		let command = 'tn93 -o';

		let tn93OutputFile;
		if (this.state.format.includes('tsv')) {
			tn93OutputFile = 'pairwise-distances.tsv';
			command += ' ' + tn93OutputFile + ' -D \t';
		} else if (this.state.format.includes('csv')) {
			tn93OutputFile = 'pairwise-distances.csv';
			command += ' ' + tn93OutputFile;
		} else {
			tn93OutputFile = 'pairwise-distances.txt';
			command += ' ' + tn93OutputFile;
		}
		this.setState({ tn93OutputFile })

		// add threshold
		command += " -t " + (this.state.threshold === "" ? DEFAULT_INPUT_STATE.threshold : this.state.threshold);

		// add ambigs
		command += " -a " + (this.state.ambigs === "string" ? DEFAULT_INPUT_STATE.ambigs : this.state.ambigs);

		// add fraction
		command += " -g " + (this.state.fraction === "" ? DEFAULT_INPUT_STATE.fraction : this.state.fraction);

		// add format
		if (!this.state.countFlag) {
			command += " -f " + this.state.format.replace("tsv", "csv");
		}

		// add overlap
		command += " -l " + (this.state.overlap === "" ? DEFAULT_INPUT_STATE.overlap : this.state.overlap);

		// add counts
		command += " -d " + `"${(this.state.counts === "" ? DEFAULT_INPUT_STATE.counts : this.state.counts)}"`;

		// add probability
		command += " -u " + (this.state.probability === "" ? DEFAULT_INPUT_STATE.probability : this.state.probability);

		// add bootstrap
		if (this.state.bootstrap) {
			command += " -b";
		}

		// add bootstrap across sites
		if (this.state.bootstrap && this.state.secondFile && this.state.bootstrapAcrossSites) {
			command += " -r";
		}

		// add count flag
		if (this.state.countFlag) {
			command += " -c";
		}

		// add compute
		if (this.state.secondFile && this.state.compute) {
			command += " -c";
		}

		// add self distance
		if (this.state.selfDistance) {
			command += " -0";
		}

		// add input file
		command += " " + INPUT_ALN_FILE;

		this.log("Running tn93...")
		const CLI = this.state.CLI;

		// create output file
		await CLI.fs.writeFile(tn93OutputFile, "", { encoding: "utf8" });

		// run tn93 in BioWASM
		this.log('\nRunning command: ' + command + '\n\n', false)
		const TN93StartTime = performance.now();
		await CLI.exec(command);
		this.log(`tn93 finished in ${((performance.now() - TN93StartTime) / 1000).toFixed(3)} seconds`);

		this.setState({ biowasmDownloadResults: true, downloadPairwise: true })
		this.runMolecularClustering(await CLI.fs.readFile(tn93OutputFile, { encoding: "utf8" }));
	}

	runMolecularClustering = (pairwiseFile) => {
		this.log("Running molecular clustering...")
		const clusteringThreshold = this.state.clusterThreshold === "" ? DEFAULT_INPUT_STATE.clusterThreshold : this.state.clusterThreshold;
		const delimiter = this.state.format.includes('tsv') ? "\t" : ",";
		let clusteringData = "SequenceName" + delimiter + "ClusterNumber\n";
		const clusters = new Map();
		const sequences = new Map();

		const lines = pairwiseFile.split("\n");
		lines.shift();

		for (const line of lines) {
			if (line === "") {
				continue;
			}

			const [seq1, seq2, dist] = this.state.format.includes('tsv') ? line.split("\t") : line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

			if (dist > clusteringThreshold) {
				continue;
			}

			if (sequences.has(seq1) && sequences.has(seq2)) {
				// merge clusters
				if (sequences.get(seq1) === sequences.get(seq2)) {
					continue;
				}

				const cluster1 = sequences.get(seq1);
				const cluster2 = sequences.get(seq2);

				// merge smaller cluster into larger cluster
				if (clusters.get(cluster1).size > clusters.get(cluster2).size) {
					for (const seq of clusters.get(cluster2)) {
						sequences.set(seq, cluster1);
					}

					clusters.get(cluster1).add(...clusters.get(cluster2));
					clusters.delete(cluster2);
				} else {
					for (const seq of clusters.get(cluster1)) {
						sequences.set(seq, cluster2);
					}

					clusters.get(cluster2).add(...clusters.get(cluster1));
					clusters.delete(cluster1);
				}

			} else if (sequences.has(seq1) && !sequences.has(seq2)) {
				// add seq2 to cluster of seq1
				sequences.set(seq2, sequences.get(seq1));
				clusters.get(sequences.get(seq1)).add(seq2);
			} else if (!sequences.has(seq1) && sequences.has(seq2)) {
				// add seq1 to cluster of seq2
				sequences.set(seq1, sequences.get(seq2));
				clusters.get(sequences.get(seq2)).add(seq1);
			} else if (!sequences.has(seq1) && !sequences.has(seq2)) {
				// create new cluster
				sequences.set(seq1, clusters.size);
				sequences.set(seq2, clusters.size);
				clusters.set(clusters.size, new Set([seq1, seq2]));
			}
		}

		// add excluded singletons 
		for (const line of lines) {
			if (line === "") {
				continue;
			}

			const [seq1, seq2, dist] = this.state.format.includes('tsv') ? line.split("\t") : line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

			if (!sequences.has(seq1)) {
				sequences.set(seq1, -1);
			}

			if (!sequences.has(seq2)) {
				sequences.set(seq2, -1);
			}
		}

		for (const [seq, cluster] of sequences) {
			clusteringData += `${seq}${delimiter}${cluster}\n`;
		}

		this.log("Molecular clustering finished!\n")
		this.setState({ clusteringData })
	}

	runFasttree = async () => {
		const CLI = this.state.CLI;

		this.log("Running FastTree for phylogenetic inference... (This takes significantly longer than the other steps)")

		const command = `fasttree${this.state.gtrModel ? " -gtr" : ""}${this.state.gammaLikelihoods ? " -gamma" : ""} -nt ${INPUT_ALN_FILE}`;

		this.log('\nRunning command: ' + command + '\n\n', false)
		const FastTreeStartTime = performance.now();
		const output = await CLI.exec(command)
		CLI.mount([{
			name: FASTTREE_OUTPUT_FILE,
			data: output.stdout,
		}]);
		this.log('\n', false)
		this.log(`FastTree finished in ${((performance.now() - FastTreeStartTime) / 1000).toFixed(3)} seconds\n`);
		this.setState({ downloadTree: true })
	}

	runLSD2 = async () => {
		const CLI = this.state.CLI;

		this.log("Running LSD2 for tree rooting and dating...")

		let command = "lsd2 -i " + FASTTREE_OUTPUT_FILE;

		// mount date file
		await CLI.mount([{
			name: "date.txt",
			data: await this.fileReaderReadFile(this.state.LSD2DateFile),
		}]);

		command += " -d date.txt";

		// outgroup file
		if (this.state.LSD2OutgroupFile) {
			await CLI.mount([{
				name: "outgroup.fas",
				data: await this.fileReaderReadFile(this.state.LSD2OutgroupFile),
			}]);

			command += " -g outgroup.fas";

			if (this.state.removeOutgroups) {
				command += " -G";
			}
		} else {
			// infer root
			if (this.state.inferRoot) {
				command += " -r a";
			}
		}

		// root date
		if (this.state.rootDate) {
			if (parseInt(this.state.rootDate) == this.state.rootDate) {
				command += " -a " + parseInt(this.state.rootDate);
			} else {
				command += ' -a "' + this.state.rootDate + '"';
			}
		}

		// null branch length
		command += " -l " + (this.state.nullBranchLength === "" ? DEFAULT_INPUT_STATE.nullBranchLength : this.state.nullBranchLength);

		// min branch length
		command += " -u " + (this.state.minBranchLength === "" ? DEFAULT_INPUT_STATE.minBranchLength : this.state.minBranchLength);

		// std dev relaxed clock
		command += " -q " + (this.state.stdDevRelaxedClock === "" ? DEFAULT_INPUT_STATE.stdDevRelaxedClock : this.state.stdDevRelaxedClock);

		// round time
		command += " -R " + (this.state.roundTime === "" ? DEFAULT_INPUT_STATE.roundTime : this.state.roundTime);

		// rate lower bound
		command += " -t " + new Number(this.state.rateLowerBound === "" ? DEFAULT_INPUT_STATE.rateLowerBound : this.state.rateLowerBound).toFixed(20);

		// variance
		command += " -v " + this.state.LSD2Variance;

		// sequence length, get with sed
		// read first 40MB
		await CLI.fs.writeFile("input-trim.aln", await CLI.read({
			path: INPUT_ALN_FILE,
			length: 40000000,
		}), { encoding: "binary" });

		const formatted = await CLI.exec("seqtk seq -l 0 input-trim.aln");
		await CLI.fs.writeFile("input-trim-formatted.aln", formatted.stdout, { encoding: "utf8" });

		const seqLength = (await CLI.exec("sed -n 2p input-trim-formatted.aln")).stdout.length;
		command += " -s " + seqLength;

		this.log('\nRunning command: ' + command + '\n', false)
		const LSD2StartTime = performance.now();
		await CLI.exec(command)
		this.log(`LSD2 finished in ${((performance.now() - LSD2StartTime) / 1000).toFixed(3)} seconds\n`);
		this.setState({ downloadLSD2: true })
	}

	downloadAlignment = () => {
		if (!this.state.viralMSADownloadResults) {
			return;
		}

		const downloads = [['sequence.fas.sam.aln', this.state.pyodide.FS.readFile(PATH_TO_PYODIDE_ROOT + "output/sequence.fas.sam.aln", { encoding: "utf8" })]]

		for (const download of downloads) {
			// first element of array is filename, second element is content
			this.downloadFile(download[0], download[1])
		}
	}

	downloadPairwise = async () => {
		if (!this.state.biowasmDownloadResults) {
			return;
		}

		const downloads = [[this.state.tn93OutputFile, await this.state.CLI.fs.readFile(this.state.tn93OutputFile, { encoding: "utf8" })]]

		for (const download of downloads) {
			// first element of array is filename, second element is content
			this.downloadFile(download[0], download[1])
		}
	}

	downloadClusters = () => {
		const tsvFormat = this.state.clusteringData.split("\n")[0].split("\t").length === 2;
		this.downloadFile("clusters." + (tsvFormat ? "tsv" : "csv"), this.state.clusteringData);
	}

	downloadTree = async () => {
		this.downloadFile(FASTTREE_OUTPUT_FILE, await this.state.CLI.fs.readFile(FASTTREE_OUTPUT_FILE, { encoding: "utf8" }));
	}

	downloadLSD2 = async () => {
		const CLI = this.state.CLI;
		const zip = new JSZip();

		const result = await CLI.fs.readFile(FASTTREE_OUTPUT_FILE + ".result", { encoding: "binary" });
		const resultDateNexus = await CLI.fs.readFile(FASTTREE_OUTPUT_FILE + ".result.date.nexus", { encoding: "binary" });
		const resultNwk = await CLI.fs.readFile(FASTTREE_OUTPUT_FILE + ".result.nwk", { encoding: "binary" });

		zip.file(FASTTREE_OUTPUT_FILE + ".result", result);
		zip.file(FASTTREE_OUTPUT_FILE + ".result.date.nexus", resultDateNexus);
		zip.file(FASTTREE_OUTPUT_FILE + ".result.nwk", resultNwk);
		const zipBlob = zip.generate({ type: "blob" })
		this.downloadFile("lsd2-results.zip", zipBlob, true);
	}

	downloadFile = (filename, content, isBlob = false) => {
		var a = document.createElement('a');
		if (isBlob) {
			const objectUrl = URL.createObjectURL(content);
			a.setAttribute('href', objectUrl);
		} else {
			a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
		}
		a.setAttribute('download', filename);
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		this.log(`Downloaded ${filename}`)
	}

	// helper function to read file as text or arraybuffer and promisify
	fileReaderReadFile = async (file, asArrayBuffer = false) => {
		return new Promise((resolve) => {
			const fileReader = new FileReader();
			fileReader.onload = () => {
				resolve(fileReader.result);
			}
			if (asArrayBuffer) {
				fileReader.readAsArrayBuffer(file);
			} else {
				fileReader.readAsText(file);
			}
		})
	}

	toggleExpandContainer = (container) => {
		this.setState(prevState => {
			return { expandedContainer: prevState.expandedContainer === container ? undefined : container }
		});
	}

	toggleOutputAutoscroll = () => {
		this.setState(prevState => { return { outputAutoscroll: !prevState.outputAutoscroll } });
	}

	showOfflineInstructions = (e) => {
		e.preventDefault();
		this.setState({ showOfflineInstructions: true })
	}

	hideOfflineInstructions = () => {
		this.setState({ showOfflineInstructions: false })
	}

	getMemory = async () => {
		try {
			const result = await performance.measureUserAgentSpecificMemory();
			this.setState(prevState => ({ peakMemory: Math.max(result.bytes, prevState.peakMemory) }))
			return result.bytes;
		} catch (error) {
			console.log(error);
		}
	}

	log = (output, extraFormat = true) => {
		const textArea = document.getElementById(OUTPUT_ID);
		const date = new Date();
		textArea.value += (extraFormat ? `${GET_TIME_WITH_MILLISECONDS(date)}: ` : '') + output + (extraFormat ? '\n' : '');
		if (this.state.outputAutoscroll) textArea.scrollTop = textArea.scrollHeight;
	}

	render() {
		return (
			<div className="root pb-5">
				<h2 className="mt-5 mb-2 text-center" >ViralWasm-Epi</h2>
				<p className="text-center my-3">
					A serverless WebAssembly-based pipeline for multi-sequence alignment and molecular clustering. <br />
					Uses ViralMSA{this.state.viralMSAVersion}, minimap2 v{MINIMAP2_VERSION}, tn93 v{TN93_VERSION}, FastTree v{FASTTREE_VERSION}, Seqtk v{SEQTK_VERSION}, and LSD2 v{LSD2_VERSION} via <a href="https://biowasm.com/" target="_blank" rel="noreferrer">Biowasm</a>.<br />
					<a href="" onClick={this.showOfflineInstructions}>Want to run offline? Click here!</a><br />
				</p>
				<div id="loading" className={this.state.siteReady ? 'd-none' : 'mt-5'}>
					<h5 className="text-center me-2">Loading </h5>
					<img className="loading-circle mb-2" src={loadingCircle} alt="loading" />
				</div>
				<div id="content" className={`${this.state.siteReady ? '' : 'd-none'} mt-4 mb-4`}>
					<div id="input" className={`${this.state.expandedContainer === 'input' && 'full-width-container'} ${this.state.expandedContainer === 'output' && 'd-none'}`}>
						<div id="input-header" className="mb-3">
							<h5 className="my-0">Input</h5>
							<h4 className="my-0">
								<i className={`bi bi-${this.state.expandedContainer === 'input' ? 'arrows-angle-contract' : 'arrows-fullscreen'}`} onClick={() => this.toggleExpandContainer('input')}></i>
							</h4>
						</div>
						<div id="ref-seq-container" className="pb-4">
							<div id="input-sequences-container" className="mb-3">
								<label htmlFor="input-sequences" className="form-label">Input Sequence File ({this.state.skipAlignment ? 'Alignment File' : 'SAM, FASTA Format'}) <span className="text-danger"> *</span></label>
								<input className={`form-control ${!this.state.validInputFile && 'is-invalid'}`} type="file" id="input-sequences" data-testid="input-sequences" onChange={this.setInputFile} />
								{this.state.useExampleInput &&
									<p className="mt-2 mb-0"><strong>Using Loaded Example Data: <a
										href={`${import.meta.env.BASE_URL || ''}${EXAMPLE_INPUT_FILE}`}
										target="_blank" rel="noreferrer">example_hiv.fas</a></strong></p>
								}
							</div>

							<div className="form-check my-4">
								<input className="form-check-input" type="checkbox" id="skip-alignment" checked={this.state.skipAlignment} onChange={this.toggleSkipAlignment} />
								<label className="form-check-label" htmlFor="skip-alignment">
									Skip Sequence Alignment
								</label>
							</div>

							<div className={`${this.state.skipAlignment ? 'd-none' : ''}`}>
								<div className={`${this.state.refFile !== undefined ? 'disabled-input' : ''}`}>
									<label htmlFor="common-sequences" className="form-label mt-2">
										Select Preloaded Reference Sequence
										{this.state.refFile !== undefined &&
											<span className='mt-2 text-warning'>
												<strong>&nbsp;(Using Selected Sequence)</strong>
											</span>
										}
									</label>
									<select className={`form-select ${!this.state.validRefFile && 'is-invalid'}`} aria-label="Default select example" id="common-sequences" value={this.state.preloadedRef ?? ''} onChange={this.setPreloadedRef}>
										<option value="">Select a Reference Sequence</option>
										{this.state.preloadRefOptions}
									</select>
								</div>

								<h5 className="mt-2 text-center">&#8213; OR &#8213;</h5>

								<div>
									<label htmlFor="ref-sequence" className="form-label">Select Reference Sequence</label>
									<div className={`input-group`}>
										<input className={`form-control ${!this.state.validRefFile && 'is-invalid'}`} type="file" id="ref-sequence" data-testid="ref-sequence" onChange={this.setRefFile} aria-describedby="ref-sequence-addon" />
										<button className="btn btn-outline-danger" type="button" id="ref-sequence-addon" onClick={this.clearRefFile}><i className="bi bi-trash"></i></button>
									</div>
								</div>

								<div className="form-check mt-4">
									<input className="form-check-input" type="checkbox" id="omit-ref" checked={this.state.omitRef} onChange={this.toggleOmitRef} />
									<label className="form-check-label" htmlFor="omit-ref">
										Omit Reference Sequence from Output
									</label>
								</div>
							</div>

							<div className="form-check mt-5">
								<input className="form-check-input" type="checkbox" id="molecular-clustering-check" data-testid="molecular-clustering-check" checked={this.state.performMolecularClustering} onChange={() => this.toggleMolecularClusteringArgs()} />
								<label className="form-check-label" htmlFor="molecular-clustering-check">
									<h6 id="perform-molecular-clustering">&nbsp;Perform Molecular Clustering <i className={`bi bi-chevron-${this.state.performMolecularClustering ? 'up' : 'down'}`}></i></h6>
								</label>
							</div>
							<hr></hr>

							<div className={`${this.state.performMolecularClustering ? '' : 'd-none'}`}>
								<p className="mb-2">TN93 Calculation Threshold: </p>
								<input type="number" className={`form-control ${!this.state.validThreshold && 'is-invalid'}`} id="input-threshold" placeholder="Default: 1.0" min="0" max="1" step="0.01" value={this.state.threshold} onInput={this.setThreshold} />

								<p className="mt-3 mb-2">Clustering Threshold: </p>
								<input type="number"
									className={`form-control ${!(this.state.validClusterThreshold) && 'is-invalid'}`}
									id="cluster-threshold" placeholder="Default: 0.015" min="0" max="1" step="0.01"
									value={this.state.clusterThreshold}
									onInput={this.setClusterThreshold}
								/>

								<p className="mt-3 mb-2">Ambiguous Nucleotide Strategy (Default: Resolve)</p>
								<select className="form-select" id="input-ambiguity" value={this.state.ambigs} onChange={this.setAmbigs}>
									<option value="resolve">Resolve</option>
									<option value="average">Average</option>
									<option value="skip">Skip</option>
									<option value="gapmm">Gapmm</option>
									<option value="string">String</option>
								</select>

								<p className={`mt-3 mb-2 ${!(this.state.ambigs === "string") && 'text-disabled'}`}>Ambiguous Nucleotide String: </p>
								<input type="text" className="form-control" id="input-ambiguity-string" disabled={!(this.state.ambigs === "string")} value={this.state.ambigsString} onInput={this.setAmbigsString} />

								<p className={`mt-3 mb-2 ${!(this.state.ambigs === "resolve" || this.state.ambigs === "string") && 'text-disabled'}`}>Maximum tolerated fraction of ambig. characters:</p>
								<input type="number" className={`form-control ${!this.state.validFraction && 'is-invalid'}`} id="input-fraction" value={this.state.fraction} onInput={this.setFraction} placeholder={`${(this.state.ambigs === "resolve" || this.state.ambigs === "string") ? 'Default: 1.0' : ''}`} min="0" max="1" step="0.01" disabled={!(this.state.ambigs === "resolve" || this.state.ambigs === "string")} />

								<p className={`mt-3 mb-2 ${this.state.countFlag && 'text-disabled'}`}>Output Format: (Default: TSV)</p>
								<select className="form-select" id="input-format" disabled={this.state.countFlag} value={this.state.format} onChange={this.setFormat}>
									<option value="tsv">TSV</option>
									<option value="tsvn">TSVN</option>
									<option value="csv">CSV</option>
									<option value="csvn">CSVN</option>
								</select>

								<p className="mt-3 mb-2">Overlap minimum:</p>
								<input type="number" className={`form-control ${!this.state.validOverlap && 'is-invalid'}`} id="input-overlap" placeholder="Default: 1" min="1" value={this.state.overlap} onInput={this.setOverlap} />

								<p className="mt-3 mb-2">Counts in name:</p>
								<input type="text" className={`form-control ${!this.state.validCounts && 'is-invalid'}`} id="input-counts" placeholder='Default: ":"' value={this.state.counts} onInput={this.setCounts} />

								<p className="mt-3 mb-2">Sequence Subsample Probability:</p>
								<input type="number" className={`form-control ${!this.state.validProbability && 'is-invalid'}`} id="input-probability" placeholder="Default: 1.0" min="0" value={this.state.probability} onInput={this.setProbability} />

								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="input-bootstrap" checked={this.state.bootstrap} onChange={this.setBootstrap} />
									<label className="form-check-label" htmlFor="input-bootstrap">
										-b: Bootstrap alignment columns
									</label>
								</div>

								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="input-bootstrap-across-sites" checked={this.state.bootstrapAcrossSites} onChange={this.setBootstrapAcrossSites} disabled={this.state.secondFile && this.state.bootstrap} />
									<label className="form-check-label" htmlFor="input-bootstrap-across-sites">
										-r: Bootstrap across sites
									</label>
								</div>

								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="input-count" checked={this.state.countFlag} onChange={this.setCountFlag} />
									<label className="form-check-label" htmlFor="input-count">
										-c: Only count pairs below the threshold
									</label>
								</div>

								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="input-compute" checked={this.state.compute} onChange={this.setCompute} disabled={this.state.secondFile} />
									<label className="form-check-label" htmlFor="input-compute">
										-m: compute inter- and intra-population means
									</label>
								</div>

								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="input-zero" checked={this.state.selfDistance} onChange={this.setSelfDistance} />
									<label className="form-check-label" htmlFor="input-zero">
										-0: report distances between each sequence and itself
									</label>
								</div>
							</div>

							<div className="form-check mt-5">
								<input className="form-check-input" type="checkbox" id="phylo-inference-check" data-testid="phylo-inference-check" checked={this.state.performPhyloInference} onChange={() => this.togglePhyloInferenceArgs()} />
								<label className="form-check-label" htmlFor="phylo-inference-check">
									<h6 id="perform-phylo-inference">&nbsp;Perform Phylogenetic Inference <i className={`bi bi-chevron-${this.state.performPhyloInference ? 'up' : 'down'}`}></i></h6>
								</label>
							</div>
							<hr></hr>

							<div className={`${this.state.performPhyloInference ? '' : 'd-none'}`}>
								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="gtr-model" checked={this.state.gtrModel} onChange={this.toggleGtrModel} />
									<label className="form-check-label" htmlFor="gtr-model">
										Use Generalized Time-Reversible (GTR) Model
									</label>
								</div>

								<div className="form-check my-4">
									<input className="form-check-input" type="checkbox" id="gamma-likelihoods" checked={this.state.gammaLikelihoods} onChange={this.toggleGammaLikelihoods} />
									<label className="form-check-label" htmlFor="gamma-likelihoods">
										Gamma Likelihoods
									</label>
								</div>
							</div>

							<div className={`form-check mt-5 ${!this.state.performPhyloInference && 'disabled-input'}`}>
								<input className="form-check-input" type="checkbox" id="lsd2-check" data-testid="lsd2-check" checked={this.state.performLSD2} onChange={() => this.toggleLSD2()} />
								<label className="form-check-label" htmlFor="lsd2-check">
									<h6 id="perform-lsd2">&nbsp;Perform Tree Rooting and Dating <i className={`bi bi-chevron-${this.state.performLSD2 ? 'up' : 'down'}`}></i></h6>
								</label>
							</div>
							<hr></hr>

							<div className={`${this.state.performLSD2 ? '' : 'd-none'}`}>
								<label htmlFor="lsd2-date-file" className="form-label">Input Date File <span className="text-danger"> *</span></label>
								<input className={`form-control ${!this.state.validLSD2DateFile && 'is-invalid'}`} type="file" id="lsd2-date-file" data-testid="lsd2-date-file" onChange={this.setLSD2DateFile} />

								<label htmlFor="lsd2-outgroup-file" className="form-label mt-3">Outgroup File</label>
								<input className={`form-control`} type="file" id="lsd2-outgroup-file" data-testid="lsd2-outgroup-file" onChange={this.setLSD2OutgroupFile} />

								<div className={`${this.state.LSD2OutgroupFile === undefined ? 'disabled-input' : ''} form-check my-4`}>
									<input className="form-check-input" type="checkbox" id="input-remove-outgroups" checked={this.state.removeOutgroups} onChange={this.toggleRemoveOutgroups} />
									<label className="form-check-label" htmlFor="input-remove-outgroups">
										&nbsp;Remove Outgroups
									</label>
								</div>

								<div className={`${this.state.LSD2OutgroupFile === undefined ? '' : 'disabled-input'} form-check my-4`}>
									<input className="form-check-input" type="checkbox" id="input-infer-root" checked={this.state.inferRoot} onChange={this.toggleInferRoot} />
									<label className="form-check-label" htmlFor="input-infer-root">
										&nbsp;Infer Root
									</label>
								</div>

								<p className="mt-3 mb-2">Root Date:</p>
								<input type="text" className={`form-control`} id="root-date" placeholder='Default: ""' value={this.state.rootDate} onInput={this.setRootDate} />

								<p className="mt-3 mb-2">Null Branch Length:</p>
								<input type="number" className={`form-control`} id="null-branch-length" placeholder="Default: -1.0" value={this.state.nullBranchLength} onInput={this.setNullBranchLength} />

								<p className="mt-3 mb-2">Minimum Branch Length:</p>
								<input type="number" className={`form-control ${!this.state.validMinBranchLength && 'is-invalid'}`} id="min-branch-length" placeholder="Default: 0" min="0" value={this.state.minBranchLength} onInput={this.setMinBranchLength} />

								<p className="mt-3 mb-2">Standard Deviation of Relaxed Clock:</p>
								<input type="number" className={`form-control ${!this.state.validStdDevRelaxedClock && 'is-invalid'}`} id="std-dev-relaxed" placeholder="Default: 0.2" min="0" value={this.state.stdDevRelaxedClock} onInput={this.setStdDevRelaxedClock} />

								<p className="mt-3 mb-2">Round Time:</p>
								<input type="number" className={`form-control ${!this.state.validRoundTime && 'is-invalid'}`} id="round-time" placeholder="Default: 365" min="0" value={this.state.roundTime} onInput={this.setRoundTime} />

								<p className="mt-3 mb-2">Rate Lower Bound:</p>
								<input type="number" className={`form-control ${!this.state.validRateLowerBound && 'is-invalid'}`} id="rate-lower-bound" placeholder="Default: 1e-10" min="0" value={this.state.rateLowerBound} onInput={this.setRateLowerBound} />

								<p className="mt-3 mb-2">Variance (Default: Use Input Branch Lenghts)</p>
								<select className="form-select" id="lsd2-variance" value={this.state.LSD2Variance} onChange={this.setLSD2Variance}>
									<option value="1">Use input branch lengths</option>
									<option value="2">Use estimated branch lengths</option>
									<option value="0">Don't use variance</option>
								</select>
							</div>
						</div>

						<button type="button" className="mt-3 btn btn-danger w-100" onClick={this.promptResetInput}>Reset Input</button>
						<button type="button" className={`mt-3 w-100 btn ${this.state.useExampleInput ? 'btn-success' : 'btn-warning'}`} onClick={this.toggleExampleData} data-testid="load-example-data">
							Load Example Data {this.state.useExampleInput ? '(Currently Using Example Data)' : ''}
						</button>
						<button type="button" className="mt-3 btn btn-primary w-100" onClick={this.runViralEpi} data-testid="run">Run ViralWasm-Epi</button>
					</div>
					<div id="output" className={`${this.state.expandedContainer === 'output' && 'full-width-container'} ${this.state.expandedContainer === 'input' && 'd-none'}`}>
						<div id="output-header" className="mb-3">
							<h5 className="my-0">Console</h5>
							<h4 className="my-0">
								<i className={`bi bi-${this.state.expandedContainer === 'output' ? 'arrows-angle-contract' : 'arrows-fullscreen'}`} onClick={() => this.toggleExpandContainer('output')}></i>
							</h4>
						</div>
						<textarea className="form-control" id="output-console" data-testid="output-text" datarows="3" spellCheck="false"></textarea>
						<div className="form-check my-3">
							<input className="form-check-input mt-1" type="checkbox" id="output-autoscroll" checked={this.state.outputAutoscroll} onChange={this.toggleOutputAutoscroll} />
							<label className="form-check-label ms-1" htmlFor="output-autoscroll">
								Autoscroll with output
							</label>
						</div>
						<div id="download-buttons" className="mt-4">
							{this.state.downloadAlignment &&
								<button type="button" className="btn btn-primary mt-3" onClick={this.downloadAlignment}>Download Alignment</button>
							}
							{this.state.downloadPairwise &&
								<button type="button" className="btn btn-primary mt-3" onClick={this.downloadPairwise}>Download Pairwise Distances</button>
							}
							{this.state.clusteringData &&
								<button type="button" className="btn btn-primary mt-3" onClick={this.downloadClusters}>Download Clusters</button>
							}
							{this.state.downloadTree &&
								<button type="button" className="btn btn-primary mt-3" onClick={this.downloadTree}>Download Phylogenetic Tree</button>
							}
							{this.state.downloadLSD2 &&
								<button type="button" className="btn btn-primary mt-3" onClick={this.downloadLSD2}>Download LSD2 Results</button>
							}
						</div>
						<div id="duration" className="my-3">
							{this.state.timeElapsed &&
								<p id="duration-text" data-testid="duration-text">Total runtime: {this.state.timeElapsed} seconds</p>
							}
							{this.state.running && !this.state.done &&
								<Fragment>
									Running ... &nbsp;
									<img id="running-loading-circle" className="loading-circle ms-2" src={loadingCircle}
										alt="loading" />
								</Fragment>
							}
						</div>
						{this.state.done && this.state.inputChanged && <div className="text-danger text-center">Warning: Form input has been interacted with since last run, run again to ensure latest output files.</div>}
					</div>
				</div>
				<footer className="d-flex w-100 justify-content-center">Source code:&nbsp;<a href="https://github.com/niema-lab/ViralWasm-Epi/" target="_blank" rel="noreferrer">github.com/niema-lab/ViralWasm-Epi</a>.<br /></footer>

				{
					this.state.showOfflineInstructions &&
					<div id="offline-instructions">
						<div className="card">
							<button type="button" className="btn-close" aria-label="Close" onClick={this.hideOfflineInstructions}></button>
							<div className="card-body">
								<h5 className="card-title text-center mt-3 mb-4">Running ViralWasm-Epi Offline</h5>
								<div dangerouslySetInnerHTML={{ __html: this.state.offlineInstructions }} />
							</div>
						</div>
					</div>
				}
			</div >
		)
	}
}

export default App