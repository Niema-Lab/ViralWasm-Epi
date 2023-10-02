SCRIPTPATH=$(dirname "$PWD")

# Download reads.fastq.gz file (1 milion sequences)
cd $SCRIPTPATH
mkdir data
cd data
curl -LO https://github.com/niemasd/ViralMSA-Paper/raw/master/data/SARSCOV2/40000/40000.01.true.fas.gz
gzip -d -f 40000.01.true.fas.gz
curl -LO https://github.com/niemasd/ViralMSA-Paper/raw/master/data/SARSCOV2/4000/4000.01.true.fas.gz
gzip -d -f 4000.01.true.fas.gz
curl -LO https://github.com/niemasd/ViralMSA-Paper/raw/master/data/SARSCOV2/400/400.01.true.fas.gz
gzip -d -f 400.01.true.fas.gz
curl -LO https://raw.githubusercontent.com/niemasd/ViralMSA-Paper/master/data/SARSCOV2/MT072688.fasta
curl -LO https://raw.githubusercontent.com/niemasd/viralmsa/master/ref_genomes/NC_001802/NC_001802.fas