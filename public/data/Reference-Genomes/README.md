# Reference-Genomes
Preprocessed reference genomes for use with ViralMSA, ViralWasm, etc. You can view all of the preprocessed reference genomes in this repository via the following web application:

https://niema-lab.github.io/Reference-Genomes/

Each reference genome was indexed as follows:

```bash
minimap2 -d REFERENCE_GENOME.FAS.MMI REFERENCE_GENOME.FAS
```

## Structured Downloads
* **[`REFS.json`](https://github.com/Niema-Lab/Reference-Genomes/releases/latest/download/REFS.json):** All reference genomes + names + shortnames
