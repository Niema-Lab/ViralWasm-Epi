SCRIPTPATH=$(dirname "$PWD")

cd $SCRIPTPATH
rm -rf data
mkdir data
cd data

curl -LO https://raw.githubusercontent.com/niemasd/ViralMSA-Paper/master/data/SARSCOV2/MT072688.fasta

for n in 100 200 400 1000 2000 4000; do
	curl -LO https://github.com/niemasd/ViralMSA-Paper/raw/master/data/SARSCOV2/$n/$n.01.true.fas.gz
done