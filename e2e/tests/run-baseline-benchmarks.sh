cd ../data

ViralMSA.py --help

# $1: sam file
# $2: output directory
run_benchmark() {
	OUT_DIR=../../benchmark-run-outputs/$2/cli
	LOG_DIR=../../benchmarks/$2/cli
	rm -rf $LOG_DIR
	rm -rf $OUT_DIR

	total_time_taken=0
	peak_memory=0

	/usr/bin/time -v minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o "$1.fas.sam" MT072688.fasta.mmi "$1.01.true.fas.gz" 2>minimap_output.log
	minimap2_time_taken=$(grep "User time (seconds): " minimap_output.log | awk '{print $4}')
	total_time_taken=$(echo "$minimap2_time_taken + $total_time_taken" | bc)
	memory=$(grep "Maximum resident set size (kbytes): " minimap_output.log | awk '{print $6}')
	if [ "$memory" -gt "$peak_memory" ]; then
		peak_memory=$memory
	fi

	/usr/bin/time -v ViralMSA.py -e email@address.com -s "$1.fas.sam" -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>viralmsa_output.log
	viralmsa_time_taken=$(grep "User time (seconds): " viralmsa_output.log | awk '{print $4}')
	total_time_taken=$(echo "$viralmsa_time_taken + $total_time_taken" | bc)
	memory=$(grep "Maximum resident set size (kbytes): " viralmsa_output.log | awk '{print $6}')
	if [ "$memory" -gt "$peak_memory" ]; then
		peak_memory=$memory
	fi

	mkdir -p $LOG_DIR
	echo $minimap2_time_taken >"$LOG_DIR/minimap2_time.log"
	echo $viral_msa_time_taken >"$LOG_DIR/viralmsa_time.log"
	echo $total_time_taken >"$LOG_DIR/time.log"
	echo $peak_memory >"$LOG_DIR/memory.log"

	rm -rf cache
	rm -rf minimap_output.log
	rm -rf viralmsa_output.log
	rm -rf "$1.fas.sam"
}

for r in {1..10}; do
	for n in 100 200 400 1000 2000 4000; do
		run_benchmark "$n" "$n.$r"
	done
done