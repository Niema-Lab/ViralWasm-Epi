export const MINIMAP2_VERSION = "2.22";
export const TN93_VERSION = "1.0.11";
export const OUTPUT_ID = "output-console";
export const MAX_SHARED_ARRAY_BUFFER_SIZE = 209715200;
export const VIRAL_MSA_LINK = "tools/ViralMSA.py";
export const VIRAL_MSA_WEB_LINK = "tools/ViralMSAWeb.py";
export const VIRAL_MSA_REPO_STRUCTURE_LINK = "data/repo_structure.json";
export const VIRAL_MSA_REF_GENOMES_DIR = "data/ref_genomes/";
export const EXAMPLE_INPUT_FILE = "data/example_hiv.fas";
export const EXAMPLE_PRELOADED_REF = "NC_001802";
export const PATH_TO_PYODIDE_ROOT = "/home/pyodide/";
export const DEFAULT_INPUT_STATE = {
	useExampleInput: false,
	inputFile: undefined,
	skipAlignment: false,
	preloadedRef: undefined,
	refFile: undefined,
	omitRef: false,

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

	clusteringOpen: false,
	clusterThreshold: 1.0,
	// whether or not to copy the threshold from the tn93 tab
	clusterThresholdCopy: true,
	validClusterThreshold: true,

};

export const CLEAR_LOG = () => {
	const textArea = document.getElementById(OUTPUT_ID);
	textArea.value = "";
}

export const LOG = (output, extraFormat = true) => {
	const textArea = document.getElementById(OUTPUT_ID);
	const date = new Date();
	textArea.value += (extraFormat ? `${getTimeWithMilliseconds(date)}: ` : '') + output + (extraFormat ? '\n' : '');
	textArea.scrollTop = textArea.scrollHeight;
}

export const getTimeWithMilliseconds = date => {
	const t = date.toLocaleTimeString();
	return `${t.substring(0, 7)}.${("00" + date.getMilliseconds()).slice(-3)}`;
}