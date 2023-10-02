# TODO: cache
# Install minimap2 
cd ~
git clone https://github.com/lh3/minimap2
cd minimap2 && make
sudo mv minimap2 /usr/local/bin/

minimap2 --version

# Install ViralMSA 
pip3 install biopython
cd ~
wget "https://raw.githubusercontent.com/niemasd/ViralMSA/master/ViralMSA.py"
chmod a+x ViralMSA.py
sudo mv ViralMSA.py /usr/local/bin/ViralMSA.py

# Confirm ViralConsensus is installed
ViralMSA.py --help

