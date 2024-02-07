VIRALMSA_DIR='../public/tools/'
VIRALMSA_DATA_DIR='../public/data/'

# save current path
CUR_DIR=$(pwd)

# update ViralMSA.py
cd $VIRALMSA_DIR
rm -rf ViralMSA.py
wget https://raw.githubusercontent.com/niemasd/ViralMSA/master/ViralMSA.py

# update data
cd $CUR_DIR
cd $VIRALMSA_DATA_DIR
rm -rf Reference-Genomes/
git clone https://github.com/Niema-Lab/Reference-Genomes.git
cd Reference-Genomes
rm -rf .github/
rm -rf .git/
python3 compile.py
mv REFS.json ../REFS.json
