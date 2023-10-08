SCRIPTPATH=$(dirname "$PWD")

cd $SCRIPTPATH
rm -rf data
mkdir data
cd data

curl -LO https://raw.githubusercontent.com/niemasd/ViralMSA-Paper/master/data/SARSCOV2/MT072688.fasta
curl -LO https://raw.githubusercontent.com/niemasd/viralmsa/master/ref_genomes/NC_001802/NC_001802.fas
curl -LO https://raw.githubusercontent.com/niemasd/viralmsa/master/example/example_hiv.fas

# index reference
minimap2 -t 1 -d NC_001802.fas.mmi NC_001802.fas
minimap2 -t 1 -d MT072688.fasta.mmi MT072688.fasta

for n in 100 200 400 1000 2000 4000; do
	curl -LO https://github.com/niemasd/ViralMSA-Paper/raw/master/data/SARSCOV2/$n/$n.01.true.fas.gz
done