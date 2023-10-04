cd ../data

ViralMSA.py --help

# $1: sam file
# $2: output directory
run_benchmark() {
	OUT_DIR=../../benchmark-run-outputs/$2/cli
	LOG_DIR=../../benchmarks/$2/cli
	rm -rf $LOG_DIR
	rm -rf $OUT_DIR

	/usr/bin/time -v ViralMSA.py -e email@address.com -s "$1.fas.sam" -o $OUT_DIR -r MT072688.fasta --viralmsa_dir cache 2>time_output.log

	mkdir -p $LOG_DIR
	grep "User time (seconds): " time_output.log | awk '{print $4}' >"$LOG_DIR/time.log"
	echo "$LOG_DIR/time.log"
	ls -lh "$OUT_DIR"
	cat "$LOG_DIR/time.log"
	grep "Maximum resident set size (kbytes): " time_output.log | awk '{print $6}' >"$LOG_DIR/memory.log"

	rm -rf cache
	rm -rf time_output.log
}

for r in {1..10}; do
	for n in 100 200 400 1000 2000 4000; do
		run_benchmark "$n" "$n.$r"
	done
done
