export const PYODIDE_VERSION = "0.23.4";
export const MINIMAP2_VERSION = "2.22";
export const TN93_VERSION = "1.0.11";
export const FASTTREE_VERSION = "2.1.11";
export const LSD2_VERSION = "2.3";
export const SED_VERSION = "4.8";
export const SEQTK_VERSION = "1.4";

export const OUTPUT_ID = "output-console";
export const OFFLINE_INSTRUCTIONS = "/README.md";
export const OFFLINE_INSTRUCTIONS_KEYWORDS_START = "<h2>ViralWasm-Epi Offline</h2>\n";
export const OFFLINE_INSTRUCTIONS_KEYWORDS_END = "<h2>Citing ViralWasm-Epi</h2>\n";
export const VIRAL_MSA_LINK = "tools/ViralMSA.py";
export const VIRAL_MSA_WEB_LINK = "tools/ViralMSAWeb.py";
export const VIRAL_MSA_REPO_STRUCTURE_LINK = "data/REFS.json";
export const VIRAL_MSA_REF_GENOMES_DIR = "data/Reference-Genomes/";
export const EXAMPLE_INPUT_FILE = "data/example_hiv.fas";
export const EXAMPLE_PRELOADED_REF = "NC_001802";
export const PATH_TO_PYODIDE_ROOT = "/home/pyodide/";
export const INPUT_ALN_FILE = "input.aln";
export const FASTTREE_OUTPUT_FILE = "phylogenetic.tree";

export const DEFAULT_INPUT_STATE = {
	useExampleInput: false,
	inputFile: undefined,
	validInputFile: true,
	
	skipAlignment: false,
	preloadedRef: undefined,
	refFile: undefined,
	validRefFile: true,
	omitRef: false,
	trimSeqAlnStart: 0,
	validTrimSeqAlnStart: true,
	trimSeqAlnEnd: 0,
	validTrimSeqAlnEnd: true,

	threshold: 1.0,
	validThreshold: true,
	ambigs: "resolve",
	ambigsString: "",
	fraction: 1.0,
	validFraction: true,
	format: "tsv",
	overlap: 1,
	validOverlap: true,
	counts: ":",
	validCounts: true,
	probability: 1,
	validProbability: true,
	bootstrap: false,
	bootstrapAcrossSites: false,
	countFlag: false,
	compute: false,
	selfDistance: false,

	performMolecularClustering: false,
	clusterThreshold: 0.015,
	validClusterThreshold: true,
	
	performPhyloInference: false,
	gtrModel: true,
	gammaLikelihoods: true,

	performLSD2: false,
	LSD2DateFile: undefined,
	validLSD2DateFile: true,
	LSD2OutgroupFile: undefined,
	removeOutgroups: false,
	inferRoot: true,
	rootDate: "",
	nullBranchLength: -1.0,
	minBranchLength: 0,
	validMinBranchLength: true,
	stdDevRelaxedClock: 0.2,
	validStdDevRelaxedClock: true,
	roundTime: 365,
	validRoundTime: true,
	rateLowerBound: 1e-10,
	validRateLowerBound: true,
	LSD2Variance: "1",
};

export const ERROR_MSG = (tool) => {
	return `Error running ${tool} as part of ViralWasm-Epi pipeline. Please check your input and try again.`;
}

export const CLEAR_LOG = () => {
	const textArea = document.getElementById(OUTPUT_ID);
	textArea.value = "";
}

export const GET_TIME_WITH_MILLISECONDS = (date) => {
	const t = date.toLocaleTimeString([], {hour12: false});
	return `${t.substring(0, 8)}.${("00" + date.getMilliseconds()).slice(-3)}`;
}