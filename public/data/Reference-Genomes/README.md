# Reference-Genomes
Preprocessed reference genomes for use with [ViralMSA](https://github.com/niemasd/ViralMSA), [ViralWasm](https://github.com/Niema-Lab/ViralWasm), etc. You can view all of the preprocessed reference genomes in this repository via the following web application:

https://niema-lab.github.io/Reference-Genomes/

Each reference genome was indexed as follows:

```bash
minimap2 -d REFERENCE_GENOME.FAS.MMI REFERENCE_GENOME.FAS
```

## Structured Downloads
* **[`REFS.json`](https://github.com/Niema-Lab/Reference-Genomes/releases/latest/download/REFS.json):** JSON file containing all reference genomes + names + shortnames
* **[`index.html`](https://github.com/Niema-Lab/Reference-Genomes/releases/latest/download/index.html):** Web page showing all reference genomes + names + shortnames as a sortable table
  * This is what populates the [GitHub Pages for this repo](https://niema-lab.github.io/Reference-Genomes/)
