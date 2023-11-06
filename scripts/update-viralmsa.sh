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
wget https://api.github.com/repos/niemasd/ViralMSA/git/trees/master?recursive=1 -O repo_structure.json
cd ref_genomes

curl https://codeload.github.com/niemasd/ViralMSA/tar.gz/master |
	tar -xz --strip=2 ViralMSA-master/ref_genomes
