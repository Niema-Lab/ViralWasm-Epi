RUN_COUNT=5
SCRIPTPATH=$(dirname "$PWD")

cd $SCRIPTPATH
rm -rf data
mkdir data
cd data

curl -LO https://github.com/Niema-Lab/ViralWasm-Files/raw/main/reference_genomes/HIV-1/NC_001802.fas

for r in $(seq 1 $RUN_COUNT); do
	for n in 100 200 300; do
		f=$(printf "%02d" $r)
		curl -LO "https://github.com/Niema-Lab/ViralWasm-Files/raw/main/benchmark_files/ViralWasm-Epi/$n/$n.$f.dates.txt"
		curl -LO "https://github.com/Niema-Lab/ViralWasm-Files/raw/main/benchmark_files/ViralWasm-Epi/$n/$n.$f.seqs.fas.gz"
	done
done
