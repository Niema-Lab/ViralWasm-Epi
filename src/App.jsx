import React, { Component } from 'react'

import './App.scss'
import loadingCircle from './assets/loading.png'

import {
	LOG,
	CLEAR_LOG,
	MAX_SHARED_ARRAY_BUFFER_SIZE,
	VIRAL_MSA_LINK,
	VIRAL_MSA_REPO_STRUCTURE_LINK
} from './constants.js';

const viralMSAWorker = new Worker(new URL('./assets/workers/viralmsaworker.js', import.meta.url));
const minimap2Worker = new Worker(new URL('./assets/workers/minimap2worker.js', import.meta.url));

export class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			REFS: undefined,
			REF_NAMES: undefined,
			refGenomes: new Set(),
			preloadRefOptions: undefined,

			exampleInput: undefined,
			useExampleInput: false,

			startTime: new Date().getTime(),

			siteTitle: "ViralMSA",
			siteReady: false,
		}
	}

	async componentDidMount() {
		// Setup WebWorkers
		viralMSAWorker.onmessage = this.handleViralMSAMessage;
		minimap2Worker.onmessage = this.handleMinimap2Message;
		// Setup shared array buffer for waiting for minimap2 to finish and transmitting file data
		const sharedArrayBuffer = new SharedArrayBuffer(MAX_SHARED_ARRAY_BUFFER_SIZE);
		const sharedArray = new Int32Array(sharedArrayBuffer);
		viralMSAWorker.postMessage({ 'arraybuffer': sharedArray })
		minimap2Worker.postMessage({ 'arraybuffer': sharedArray })

		// Other initialization
		this.getViralMSAVersion();
		this.fetchPreloadedRef();
		this.initPreloadedRefs();
	}

	getViralMSAVersion = async () => {
		try {
			const VERSION = [...(await (await fetch(VIRAL_MSA_LINK)).text()).matchAll(/VERSION = '([0-9|.]*)'/gm)][0][1];
			const siteTitle = "ViralMSA v" + VERSION;
			this.setState({ siteTitle });
			document.title = siteTitle;
		} catch (error) {
			console.log(error);
		}
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

	handleViralMSAMessage = (event) => {
		if (event.data.error) {
			// error handling
			alert(event.data.error);
		} else if (event.data.init) {
			// done loading pyodide / ViralMSA 
			this.setState({ REFS: event.data.REFS, REF_NAMES: event.data.REF_NAMES })
			LOG("ViralMSA Loaded.")
		} else if (event.data.download) {
			// download results
			for (const download of event.data.download) {
				// first element of array is filename, second element is content
				downloadFile(download[0], download[1])
			}
		} else if (event.data.pyodideConsole) {
			// updating console
			// TODO: is this correct output format?
			LOG(event.data.pyodideConsole)
		} else if (event.data.finished) {
			// on ViralMSA finish
			// TODO: refactor into react state
			document.getElementById("duration-text").innerText = "Total runtime: " + (new Date().getTime() - startTime) / 1000 + " seconds";
			document.getElementById("running-loading-circle").classList.add("d-none");
			document.getElementById("downloadResults").disabled = false;
		} else if (event.data.runminimap2) {
			// Pyodide call to run minimap2 
			if (event.data.runminimap2 === 'alignment') {
				minimap2Worker.postMessage({ 'runminimap2': 'alignment', 'command': event.data.command, 'refSeq': event.data.refSeq });
			} else if (event.data.runminimap2 === 'buildIndex') {
				minimap2Worker.postMessage({ 'runminimap2': 'buildIndex', 'command': event.data.command, 'inputSeq': event.data.inputSeq });
			}
		}
	}

	handleMinimap2Message = (event) => {
		// Minimap2 done running
		if (event.data.minimap2done) {
			const fileData = event.data.minimap2done === 'alignment' ? event.data.sam : event.data.mmi;

			// adjust array size to be divisible by 4
			const adjustedArray = new Uint8Array(Math.ceil(fileData.length / 4) * 4);
			adjustedArray.set(fileData);
			// update shared array buffer
			sharedArray.set(new Uint32Array(adjustedArray.buffer), 0)

			// notify ViralMSA WebWorker that Minimap2 is done
			Atomics.notify(sharedArray, 0);
		}
	}

	render() {
		return (
			<div className="root">
				<h2 className="mt-5 mb-2 text-center" id="site-title">{this.state.siteTitle}</h2>
				<p className="text-center my-3">
					WebAssembly implementation of <a href="https://www.github.com/niemasd/ViralMSA" target="_blank"
						rel="noreferrer">ViralMSA</a>.<br />
					Created by Daniel Ji, UCSD Undergraduate Student Researcher for Professor <a href="https://www.niema.net"
						target="_blank" rel="noreferrer">Niema Moshiri</a>
				</p>
				<div id="loading" className={this.state.siteReady ? 'd-none' : ''}>
					<h4 className="text-center me-2">Loading </h4>
					<img id="site-loading-circle" className="loading-circle" src={loadingCircle} alt="loading" />
				</div>
				<div id="content" className={`${this.state.siteReady ? '' : 'd-none'} mt-3`}>
					<div className="input">
						<h5 className="w-100 text-start mb-3">Input</h5>
						<div id="ref-seq-container">
							<div id="input-sequences-container" className="mb-3">
								<label htmlFor="input-sequences" className="form-label">Input Sequences (FASTA Format)</label>
								<input className="form-control" type="file" id="input-sequences" />
								<p id="loaded-example-indicator" className="mt-2 d-none"><strong>Loaded Example Data: <a
									href="https://raw.githubusercontent.com/niemasd/viralmsa/master/example/example_hiv.fas"
									target="_blank" rel="noreferr
						">example_hiv.fas</a></strong></p>
							</div>

							<label htmlFor="common-sequences" className="form-label mt-2">Select Preloaded Reference Sequence</label>
							<select className="form-select" aria-label="Default select example" id="common-sequences">
								{/* TODO: add default undefined and bind to react state */}
								<option>Select a Reference Sequence</option>
								{this.state.preloadRefOptions}
							</select>

							<h5 className="mt-2 text-center">&#8213; OR &#8213;</h5>

							<div>
								<label htmlFor="ref-sequence" className="form-label">Upload Reference Sequence</label>
								<input className="form-control" type="file" id="ref-sequence" />
							</div>

							<div className="form-check mt-4">
								<input className="form-check-input" type="checkbox" value="" id="omit-ref" />
								<label className="form-check-label" htmlFor="omit-ref">
									Omit Reference Sequence from Output
								</label>
							</div>
						</div>

						<button type="button" className="mt-3 btn btn-warning w-100" id="loadExample">Load Example Data</button>
						<button type="button" className="mt-3 btn btn-primary w-100" id="runViralMSA">Run ViralMSA</button>
					</div>
					<div className="output">
						<h5 className="mb-3">Console</h5>
						<textarea className="form-control" id="output-console" rows="3"></textarea>
						<button type="button" className="mt-4 btn btn-primary w-100" id="downloadResults" disabled>Download
							Results</button>
						<div id="duration">
							<p id="duration-text" className="my-3"></p>
							<img id="running-loading-circle" className="loading-circle d-none ms-2" src={loadingCircle}
								alt="loading" />
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default App