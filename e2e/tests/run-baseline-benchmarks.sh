cd ../data
# $1: output directory
# $2: sam file
run_benchmark() {
	OUT_DIR=../../benchmark-run-outputs/$1
	LOG_DIR=../../benchmarks/$1/cli/
	rm -rf $LOG_DIR

	/usr/bin/time -v ViralMSA.py -e email@address.com -s $2 -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>time_output.log

	mkdir -p $LOG_DIR
	grep "User time (seconds): " time_output.log | awk '{print $4}' > "$LOG_DIR/time.log"
	grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' > "$LOG_DIR/memory.log"

	rm -rf cache
	rm -rf time_output.log
}

for n in 100 200 400 1000 2000 4000 ; do 
	for r in {1..10}; do 
		run_benchmark "$n.$r" "$n.fas.sam"
	done
done