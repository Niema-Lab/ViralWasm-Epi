# Install minimap2 
cd ~
git clone https://github.com/lh3/minimap2 --branch v2.22
cd minimap2 && make
sudo mv minimap2 /usr/local/bin/
minimap2 --version

# Install ViralMSA 
pip3 install biopython
cd ~
wget "https://raw.githubusercontent.com/niemasd/ViralMSA/master/ViralMSA.py"
chmod a+x ViralMSA.py
sudo mv ViralMSA.py /usr/local/bin/
ViralMSA.py --help

# Install TN93
cd ~
git clone https://github.com/veg/tn93.git --branch v.1.0.11
cd tn93
cmake .
make install
sudo mv tn93 /usr/local/bin/
tn93 --version

# Install FastTree
cd ~
wget "https://www.microbesonline.org/fasttree/FastTreeDbl"
chmod a+x FastTreeDbl
sudo mv FastTreeDbl /usr/local/bin/FastTree
FastTree

# Install LSD2
cd ~
git clone https://github.com/tothuhien/lsd2.git --branch v.2.3
cd lsd2/src
make clean
make
sudo mv lsd2 /usr/local/bin/
lsd2 -h