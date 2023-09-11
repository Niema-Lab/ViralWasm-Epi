// TODO: don't manually create offline files
// TODO: speed up load time / run time
// TODO: incorporate gzip wherever and optimize memory usage
// TODO: firefox issue with webworker CORP
// TODO: add warning input has changed
import React, { Component, Fragment } from 'react'

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import './App.scss'
import loadingCircle from './assets/loading.png'

import {
	LOG,
	CLEAR_LOG,
	MAX_SHARED_ARRAY_BUFFER_SIZE,
	VIRAL_MSA_REPO_STRUCTURE_LINK,
	EXAMPLE_INPUT_FILE,
	EXAMPLE_PRELOADED_REF,
	DEFAULT_INPUT_STATE,
	VIRAL_MSA_REF_GENOMES_DIR,
	MINIMAP2_VERSION,
	TN93_VERSION
} from './constants.js';

const viralMSAWorker = new Worker(new URL('./assets/workers/viralmsaworker.js', import.meta.url), { type: 'module' });
const biowasmWorker = new Worker(new URL('./assets/workers/biowasmworker.js', import.meta.url), { type: 'module' });

export class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			REFS: undefined,
			REF_NAMES: undefined,
			viralMSAVersion: undefined,
			refGenomes: new Set(),
			exampleInput: undefined,
			preloadRefOptions: undefined,

			...DEFAULT_INPUT_STATE,

			tn93Open: false,

			startTime: new Date().getTime(),
			timeElapsed: undefined,
			running: false,
			runningViralMSA: false,
			done: false,
			downloadAlignment: false,
			downloadPairwise: false,
			clusteringData: undefined,

			siteReady: false,
			expandedContainer: undefined,

			sharedArray: undefined,
		}
	}

	async componentDidMount() {
		// Setup WebWorkers
		viralMSAWorker.onmessage = this.handleViralMSAMessage;
		biowasmWorker.onmessage = this.handleBiowasmMessage;
		// Setup shared array buffer for waiting for minimap2 to finish and transmitting file data
		const sharedArrayBuffer = new SharedArrayBuffer(MAX_SHARED_ARRAY_BUFFER_SIZE);
		const sharedArray = new Int32Array(sharedArrayBuffer);
		viralMSAWorker.postMessage({ arraybuffer: sharedArray })
		biowasmWorker.postMessage({ arraybuffer: sharedArray })
		this.setState({ sharedArray })

		// Other initialization
		this.disableNumberInputScroll();
		this.fetchPreloadedRef();
		this.initPreloadedRefs();
		this.fetchExampleInput();
	}

	disableNumberInputScroll = () => {
		document.addEventListener("wheel", () => {
			if (document.activeElement.type === "number") {
				document.activeElement.blur();
			}
		});
	}

	fetchPreloadedRef = async () => {
		const res = await fetch(VIRAL_MSA_REPO_STRUCTURE_LINK);
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
				this.setState({ siteReady: true, preloadRefOptions })
			}
		}, 250)
	}

	fetchExampleInput = async () => {
		this.setState({
			exampleInput: await (await fetch(EXAMPLE_INPUT_FILE)).text()
		})
	}

	handleViralMSAMessage = (event) => {
		if (event.data.error) {
			// error handling
			this.setState({ running: false, done: false, timeElapsed: undefined })
			alert(event.data.error);
		} else if (event.data.init) {
			// done loading pyodide / ViralMSA 
			this.setState({ REFS: event.data.REFS, REF_NAMES: event.data.REF_NAMES, viralMSAVersion: ' v' + event.data.VERSION })
			LOG("ViralMSA loaded.")
		} else if (event.data.download) {
			// download results
			for (const download of event.data.download) {
				// first element of array is filename, second element is content
				LOG(`Downloading ${download[0]}`)
				this.downloadFile(download[0], download[1])
			}
		} else if (event.data.log) {
			// updating console
			LOG(event.data.log, false)
		} else if (event.data.finished) {
			// on ViralMSA finish, run tn93
			LOG("ViralMSA finished!\n")
			this.setState({ downloadAlignment: true })
			this.runTN93(false, event.data.output);
		} else if (event.data.runMinimap2) {
			// Pyodide call to run minimap2 
			if (event.data.runMinimap2 === 'alignment') {
				biowasmWorker.postMessage({ runMinimap2: 'alignment', command: event.data.command, refSeq: event.data.refSeq });
			} else if (event.data.runMinimap2 === 'buildIndex') {
				biowasmWorker.postMessage({ runMinimap2: 'buildIndex', command: event.data.command, inputSeq: event.data.inputSeq });
			}
		}
	}

	handleBiowasmMessage = (event) => {
		if (event.data.init) {
			LOG("Biowasm loaded.")
		}

		// minimap2 done running
		if (event.data.minimap2done) {
			const fileData = event.data.minimap2done === 'alignment' ? event.data.sam : event.data.mmi;

			// adjust array size to be divisible by 4
			const adjustedArray = new Uint8Array(Math.ceil(fileData.length / 4) * 4);
			adjustedArray.set(fileData);
			// update shared array buffer
			this.state.sharedArray.set(new Uint32Array(adjustedArray.buffer), 0)

			// notify ViralMSA WebWorker that minimap2 is done
			Atomics.notify(this.state.sharedArray, 0);
		}

		// tn93 done running
		if (event.data.tn93done) {
			LOG("tn93 finished!\n")
			this.setState({ downloadPairwise: true })
			this.runMolecularClustering(event.data.output);
		}

		// log messages from biowasmworker
		if (event.data.log) {
			LOG(event.data.log, false)
		}

		// download results from biowasmworker
		if (event.data.download) {
			for (const download of event.data.download) {
				// first element of array is filename, second element is content
				LOG(`Downloading ${download[0]}`)
				this.downloadFile(download[0], download[1])
			}
		}
	}

	setInputFile = (event) => {
		this.setState({ useExampleInput: false, inputFile: event.target.files[0] })
	}

	setPreloadedRef = (event) => {
		this.setState({ preloadedRef: event.target.value === 'undefined' ? undefined : event.target.value })
	}

	setRefFile = (event) => {
		this.setState({ refFile: event.target.files[0] })
	}

	clearRefFile = () => {
		this.setState({ refFile: undefined })
		document.getElementById('ref-sequence').value = null;
	}

	toggleSkipAlignment = () => {
		this.setState(prevState => ({ skipAlignment: !prevState.skipAlignment }))
	}

	toggleOmitRef = () => {
		this.setState(prevState => ({ omitRef: !prevState.omitRef }))
	}

	setThreshold = (event) => {
		this.setState({ threshold: event.target.value, inputChanged: true, validThreshold: event.target.value >= 0 && event.target.value <= 1 })
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
		this.setState({ overlap: event.target.value, inputChanged: true, validOverlap: event.target.value >= 1 && event.target.value == parseInt(event.target.value) })
	}

	setCounts = (event) => {
		this.setState({ counts: event.target.value, inputChanged: true, validCounts: event.target.value.length === 1 })
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

	toggleTN93Args = (open = undefined) => {
		this.setState(prevState => {
			return { tn93Open: open === undefined ? !prevState.tn93Open : open }
		})
	}

	setClusterThreshold = (event) => {
		this.setState({ clusterThreshold: event.target.value, inputChanged: true, validClusterThreshold: event.target.value >= 0 && event.target.value <= 1, clusterThresholdCopy: false })
	}

	toggleClusteringArgs = (open = undefined) => {
		this.setState(prevState => {
			return { clusteringOpen: open === undefined ? !prevState.clusteringOpen : open }
		})
	}

	toggleExampleData = () => {
		this.setState(prevState => ({ useExampleInput: !prevState.useExampleInput, preloadedRef: prevState.useExampleInput ? prevState.preloadedRef : EXAMPLE_PRELOADED_REF }))
	}

	promptResetInput = () => {
		if (window.confirm("Are you sure you want to reset? All input data will be lost.")) {
			this.resetInput();
		}
	}

	resetInput = () => {
		this.setState(Object.assign({}, DEFAULT_INPUT_STATE));
		document.getElementById('input-sequences').value = null;
		document.getElementById('ref-sequence').value = null;
	}

	runViralEpi = async () => {
		// validation
		if (!this.state.useExampleInput && this.state.inputFile === undefined) {
			alert("Please upload an input sequence file.");
			return;
		}

		this.setState({ running: true, done: false, timeElapsed: undefined, startTime: new Date().getTime(), downloadAlignment: false, downloadPairwise: false, clusteringData: undefined })

		if (this.state.skipAlignment) {
			if (this.state.useExampleInput) {
				alert('Cannot skip alignment when using example data.');
				return;
			}

			if (this.validTN93()) {
				await this.runTN93(true, this.state.inputFile);
			}
		} else {
			await this.runViralMSA();
		}
	}

	validTN93 = () => {
		let valid = this.state.validThreshold && this.state.validFraction && this.state.validOverlap && this.state.validCounts && this.state.validProbability;

		if (!valid) {
			this.toggleTN93Args();
			alert("Please enter valid TN93 arguments.");
			return false;
		}

		return true;
	}

	runTN93 = async (standalone, alignmentFile) => {
		if (standalone) {
			CLEAR_LOG();
			this.setState({ runningViralMSA: false })
		}

		let command = 'tn93 -o';

		if (this.state.format.includes('tsv')) {
			command += ' pairwise-distances.tsv -D \t';
		} else if (this.state.format.includes('csv')) {
			command += ' pairwise-distances.csv';
		} else {
			command += ' pairwise-distances.txt';
		}

		// add threshold
		command += " -t " + (this.state.threshold === "" ? "1.0" : this.state.threshold);

		// add ambigs
		command += " -a " + (this.state.ambigs === "string" ? this.state.ambigsString : this.state.ambigs);

		// add fraction
		command += " -g " + (this.state.fraction === "" ? "1.0" : this.state.fraction);

		// add format
		if (!this.state.countFlag) {
			command += " -f " + this.state.format.replace("tsv", "csv");
		}

		// add overlap
		command += " -l " + (this.state.overlap === "" ? "0" : this.state.overlap);

		// add counts
		command += " -d " + `"${(this.state.counts === "" ? ":" : this.state.counts)}"`;

		// add probability
		command += " -u " + (this.state.probability === "" ? "1" : this.state.probability);

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
		command += " input.fas";

		LOG("Reading input sequence file...")
		const alignmentFileText = typeof alignmentFile === 'string' ? alignmentFile : await this.fileReaderReadFile(alignmentFile);

		LOG("Running tn93...")
		biowasmWorker.postMessage({
			runTN93: true,
			alignmentFile: alignmentFileText,
			command
		});
	}

	runViralMSA = async () => {
		// further validation
		if (this.state.preloadedRef === undefined && this.state.refFile === undefined) {
			alert("Please upload or select a reference sequence file.");
			return;
		}

		// validation passed
		// clear console and runtime record
		CLEAR_LOG();
		this.setState({ runningViralMSA: true })

		let inputSeq;
		let refSeq;
		let refIndex;
		let refID;

		// sending file data to webworker
		LOG("Reading input sequence file...")
		if (this.state.useExampleInput) {
			inputSeq = this.state.exampleInput;
		} else {
			inputSeq = await this.fileReaderReadFile(this.state.inputFile);
		}

		if (this.state.refFile) {
			refSeq = await this.fileReaderReadFile(this.state.refFile);
		} else {
			// only need to provide refID when using a preloaded reference sequence and index
			refID = this.state.preloadedRef;
			// write reference index to minimap2 since it will never be built
			refIndex = new Uint8Array(await (await fetch(VIRAL_MSA_REF_GENOMES_DIR + refID + "/" + refID + ".fas.mmi")).arrayBuffer());
			biowasmWorker.postMessage({ writeIndex: refIndex })
		}

		// wait until file data is read and then run ViralMSA
		const interval = setInterval(() => {
			if (inputSeq && (refSeq || refID)) {
				clearInterval(interval);
				LOG("Running ViralMSA...")
				viralMSAWorker.postMessage({ run: 'viralmsa', inputSeq, refSeq, refID, 'omitRef': this.state.omitRef });
			}
		}, 100);
	}

	runMolecularClustering = (pairwiseFile) => {
		LOG("Running molecular clustering...")
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

			if (dist > (this.state.clusterThresholdCopy ? this.state.threshold : this.state.clusterThreshold)) {
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

		LOG("Molecular clustering finished!\n")
		this.setState({ clusteringData, done: true, timeElapsed: (new Date().getTime() - this.state.startTime) / 1000 })
	}

	downloadAlignment = () => {
		viralMSAWorker.postMessage({ getResults: 'all' });
	}

	downloadPairwise = () => {
		biowasmWorker.postMessage({ getResults: 'all' });
	}

	downloadClusters = () => {
		const tsvFormat = this.state.clusteringData.split("\n")[0].split("\t").length === 2;
		this.downloadFile("clusters." + (tsvFormat ? "tsv" : "csv"), this.state.clusteringData);
	}

	downloadFile = (filename, text) => {
		var a = document.createElement('a');
		a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		a.setAttribute('download', filename);
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
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

	render() {
		return (
			<div className="root">
				<h2 className="mt-5 mb-2 text-center" >ViralWasm-Epi</h2>
				<p className="text-center my-3">
					A serverless WebAssembly-based pipeline for multi-sequence alignment and molecular clustering. <br /> Uses ViralMSA{this.state.viralMSAVersion}, minimap2 v{MINIMAP2_VERSION}, and tn93 v{TN93_VERSION} via <a href="https://biowasm.com/" target="_blank" rel="noreferrer">Biowasm</a>.
				</p>
				<div id="loading" className={this.state.siteReady ? 'd-none' : 'mt-4'}>
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
						<div id="ref-seq-container">
							<div id="input-sequences-container" className="mb-3">
								<label htmlFor="input-sequences" className="form-label">Input Sequence File (FASTA Format)</label>
								<input className="form-control" type="file" id="input-sequences" onChange={this.setInputFile} />
								{this.state.useExampleInput &&
									<p className="mt-2 mb-0"><strong>Using Loaded Example Data: <a
										href={EXAMPLE_INPUT_FILE}
										target="_blank" rel="noreferrer">example_hiv.fas</a></strong></p>
								}
							</div>

							<div className="form-check my-4">
								<input className="form-check-input" type="checkbox" value="" id="skip-alignment" checked={this.state.skipAlignment} onChange={this.toggleSkipAlignment} />
								<label className="form-check-label" htmlFor="skip-alignment">
									Skip Sequence Alignment
								</label>
							</div>

							<div className={`${this.state.skipAlignment ? 'd-none' : ''}`}>
								<label htmlFor="common-sequences" className="form-label mt-2">
									Select Preloaded Reference Sequence
									{this.state.refFile !== undefined &&
										<span className='mt-2 text-warning'>
											<strong>&nbsp;(Warning: Using Uploaded Reference File)</strong>
										</span>
									}
								</label>
								<select className="form-select" aria-label="Default select example" id="common-sequences" value={this.state.preloadedRef ?? ''} onChange={this.setPreloadedRef}>
									<option value="">Select a Reference Sequence</option>
									{this.state.preloadRefOptions}
								</select>

								<h5 className="mt-2 text-center">&#8213; OR &#8213;</h5>

								<div>
									<label htmlFor="ref-sequence" className="form-label">Upload Reference Sequence</label>
									<div className="input-group">
										<input className="form-control" type="file" id="ref-sequence" onChange={this.setRefFile} aria-describedby="ref-sequence-addon" />
										<button className="btn btn-outline-danger" type="button" id="ref-sequence-addon" onClick={this.clearRefFile}><i className="bi bi-trash"></i></button>
									</div>
								</div>

								<div className="form-check mt-4">
									<input className="form-check-input" type="checkbox" value="" id="omit-ref" checked={this.state.omitRef} onChange={this.toggleOmitRef} />
									<label className="form-check-label" htmlFor="omit-ref">
										Omit Reference Sequence from Output
									</label>
								</div>
							</div>

							<h6 className="mt-5" id="tn93-arguments" onClick={() => this.toggleTN93Args()}>TN93 Arguments <i className={`bi bi-chevron-${this.state.tn93Open ? 'up' : 'down'}`}></i></h6>
							<hr></hr>

							<div className={`${this.state.tn93Open ? '' : 'd-none'}`}>
								<p className="mb-2">Threshold: </p>
								<input type="number" className={`form-control ${!this.state.validThreshold && 'is-invalid'}`} id="input-threshold" placeholder="Default: 1.0" min="0" max="1" step="0.01" value={this.state.threshold} onInput={this.setThreshold} />

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

							<h6 className="mt-5" id="clustering-arguments" onClick={() => this.toggleClusteringArgs()}>Molecular Clustering Arguments <i className={`bi bi-chevron-${this.state.clusteringOpen ? 'up' : 'down'}`}></i></h6>
							<hr></hr>

							<div className={`${this.state.clusteringOpen ? '' : 'd-none'}`}>
								<p className="mb-2">Cluster Threshold: (Default: TN93 Threshold)</p>
								<input type="number"
									className={`form-control ${!(this.state.clusterThresholdCopy ? this.state.validThreshold : this.state.validClusterThreshold) && 'is-invalid'}`}
									id="cluster-threshold" placeholder="Default: TN93 Threshold" min="0" max="1" step="0.01"
									value={this.state.clusterThresholdCopy ? this.state.threshold : this.state.clusterThreshold}
									onInput={this.setClusterThreshold}
								/>
							</div>
						</div>

						<button type="button" className="mt-3 btn btn-danger w-100" onClick={this.promptResetInput}>Reset Input</button>
						<button type="button" className={`mt-3 w-100 btn ${this.state.useExampleInput ? 'btn-success' : 'btn-warning'}`} onClick={this.toggleExampleData}>
							Load Example Data {this.state.useExampleInput ? '(Currently Using Example Data)' : ''}
						</button>
						<button type="button" className="mt-3 btn btn-primary w-100" onClick={this.runViralEpi}>Run ViralWasm-Epi</button>
					</div>
					<div id="output" className={`${this.state.expandedContainer === 'output' && 'full-width-container'} ${this.state.expandedContainer === 'input' && 'd-none'}`}>
						<div id="output-header" className="mb-3">
							<h5 className="my-0">Console</h5>
							<h4 className="my-0">
								<i className={`bi bi-${this.state.expandedContainer === 'output' ? 'arrows-angle-contract' : 'arrows-fullscreen'}`} onClick={() => this.toggleExpandContainer('output')}></i>
							</h4>
						</div>
						<textarea className="form-control" id="output-console" rows="3" spellCheck="false"></textarea>
						<div id="download-buttons" className="mt-4">
							{this.state.downloadAlignment &&
								<button type="button" className="btn btn-primary w-100 mx-3" onClick={this.downloadAlignment}>Download Alignment</button>
							}
							{this.state.downloadPairwise &&
								<button type="button" className="btn btn-primary w-100 mx-3" onClick={this.downloadPairwise}>Download Pairwise Distances</button>
							}
							{this.state.clusteringData &&
								<button type="button" className="btn btn-primary w-100 mx-3" onClick={this.downloadClusters}>Download Clusters</button>
							}
						</div>
						<div id="duration" className="my-3">
							{this.state.timeElapsed &&
								<p id="duration-text">Total runtime: {this.state.timeElapsed} seconds</p>
							}
							{this.state.running && !this.state.done &&
								<Fragment>
									Running ... &nbsp;
									<img id="running-loading-circle" className="loading-circle ms-2" src={loadingCircle}
										alt="loading" />
								</Fragment>
							}
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default App