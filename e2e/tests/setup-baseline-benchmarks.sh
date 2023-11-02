# Install minimap2 
cd ~
git clone https://github.com/lh3/minimap2 --branch v2.22
cd minimap2 && make
sudo mv minimap2 /usr/local/bin/
minimap2 --version

# Install ViralMSA 
cd ~
wget "https://github.com/Niema-Lab/ViralWasm-Epi/raw/master/public/tools/ViralMSA.py"
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
wget "https://github.com/Niema-Lab/ViralWasm-Files/raw/main/tools/FastTree-v2.1.11/FastTree.c"
gcc -DUSE_DOUBLE -O3 -finline-functions -funroll-loops -Wall -o FastTree FastTree.c -lm
sudo mv FastTree /usr/local/bin/fasttree
rm FastTree.c
fasttree

# Install seqtk
cd ~
git clone https://github.com/lh3/seqtk.git --branch v1.4
cd seqtk
make
sudo mv seqtk /usr/local/bin/
seqtk

# Install LSD2
cd ~
git clone https://github.com/tothuhien/lsd2.git --branch v.2.3
cd lsd2/src
make clean
make
sudo mv lsd2 /usr/local/bin/
lsd2 -h