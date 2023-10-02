cd ../data
rm -rf ../../benchmarks
mkdir ../../benchmarks
# $1: output directory
# $2: reads file
run_benchmark() {
	OUT_DIR=../../benchmarks/$1/cli/
	rm -rf $OUT_DIR

	minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o sequence.fas.sam MT072688.fasta.mmi $2
	/usr/bin/time -v ViralMSA.py -e email@address.com -s sequence.fas.sam -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>time_output.log

	grep "User time (seconds): " time_output.log | awk '{print $4}' > "$OUT_DIR/time.log"
	grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' > "$OUT_DIR/memory.log"

	rm -rf cache
	rm -rf time_output.log
	rm -rf sequence.fas.sam
}

for n in 100 200 400 1000 2000 4000 ; do 
	for r in {1..10}; do 
		run_benchmark "$n.$r" "$n.01.true.fas"
	done
done