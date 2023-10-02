cd ../data

# index reference
minimap2 -t 1 -d NC_001802.fas.mmi NC_001802.fas
minimap2 -t 1 -d MT072688.fasta.mmi MT072688.fasta

### TEST #1: Example data
OUT_DIR=../../benchmarks/example/cli/
rm -rf $OUT_DIR

minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o sequence.fas.sam NC_001802.fas.mmi example_hiv.fas
/usr/bin/time -v ViralMSA.py -e email@address.com -s sequence.fas.sam -o $OUT_DIR -r NC_001802.fas --viralmsa_dir cache 2>time_output.log

grep "User time (seconds): " time_output.log | awk '{print $4}' > "$OUT_DIR/time.log"
grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' > "$OUT_DIR/memory.log"

rm -rf cache
rm -rf time_output.log
rm -rf sequence.fas.sam

### TEST #2: 400 reads
OUT_DIR=../../benchmarks/400/cli/
rm -rf $OUT_DIR

minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o sequence.fas.sam MT072688.fasta.mmi '400.01.true.fas'
/usr/bin/time -v ViralMSA.py -e email@address.com -s sequence.fas.sam -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>time_output.log

grep "User time (seconds): " time_output.log | awk '{print $4}' > "$OUT_DIR/time.log"
grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' > "$OUT_DIR/memory.log"

rm -rf cache
rm -rf time_output.log
rm -rf sequence.fas.sam

### TEST #3: 4000 reads
OUT_DIR=../../benchmarks/4000/cli/
rm -rf $OUT_DIR

minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o sequence.fas.sam MT072688.fasta.mmi '4000.01.true.fas'
/usr/bin/time -v ViralMSA.py -e email@address.com -s sequence.fas.sam -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>time_output.log

grep "User time (seconds): " time_output.log | awk '{print $4}' > "$OUT_DIR/time.log"
grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' > "$OUT_DIR/memory.log"

rm -rf cache
rm -rf time_output.log
rm -rf sequence.fas.sam

### TEST #4: 40000 reads
OUT_DIR=../../benchmarks/40000/cli/
rm -rf $OUT_DIR

minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o sequence.fas.sam MT072688.fasta.mmi '40000.01.true.fas'
/usr/bin/time -v ViralMSA.py -e email@address.com -s sequence.fas.sam -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>time_output.log

grep "User time (seconds): " time_output.log | awk '{print $4}' > "$OUT_DIR/time.log"
grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' > "$OUT_DIR/memory.log"

rm -rf cache
rm -rf time_output.log
rm -rf sequence.fas.sam
