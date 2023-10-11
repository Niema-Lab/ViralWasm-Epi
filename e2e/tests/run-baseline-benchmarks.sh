TEST_COUNT=5

cd ../data

ViralMSA.py --help

# $1: sequence count
# $2: run number
run_benchmark() {
	OUT_DIR=../../benchmark-run-outputs/$1.$2/cli
	LOG_DIR=../../benchmarks/$1.$2/cli
	rm -rf $LOG_DIR
	rm -rf $OUT_DIR
	mkdir -p $LOG_DIR

	total_time_taken=0
	peak_memory=0

	# $1: tool
	update_stats() {
		time_taken=$(grep "User time (seconds): " ${1}_output.log | awk '{print $4}')
		total_time_taken=$(echo "$time_taken + $total_time_taken" | bc)
		memory=$(grep "Maximum resident set size (kbytes): " ${1}_output.log | awk '{print $6}')
		if [ "$memory" -gt "$peak_memory" ]; then
			peak_memory=$memory
		fi
		echo $time_taken >"$LOG_DIR/${1}_time.log"
	}

	/usr/bin/time -v minimap2 -t 1 --score-N=0 --secondary=no --sam-hit-only -a -o $1.fas.sam NC_001802.fas $1.$2.seqs.fas.gz 2>minimap2_output.log
	update_stats minimap2

	/usr/bin/time -v ViralMSA.py -e email@address.com -s $1.fas.sam -o $OUT_DIR -r NC_001802.fas --viralmsa_dir cache 2>viralmsa_output.log
	update_stats viralmsa

	/usr/bin/time -v tn93 -o $OUT_DIR/pairwise-distances.tsv -D "	" -t 1 -a resolve -g 1 -f csv -l 1 -d ":" -u 1 $OUT_DIR/$1.fas.sam.aln 2>tn93_output.log
	update_stats tn93

	/usr/bin/time -v fasttree -gtr -gamma -nt $OUT_DIR/$1.fas.sam.aln >$OUT_DIR/phylogenetic.tree 2>fasttree_output.log
	update_stats fasttree

	# get sequence length for lsd2
	sequence_length=$(seqtk seq -l 0 $OUT_DIR/$1.fas.sam.aln | sed -n '2p' | wc -c)

	lsd2 -i $OUT_DIR/phylogenetic.tree  -d $1.$2.dates.txt -r a -l -1 -u 0 -q 0.2 -R 365 -t 0.00000000010000000000 -v 1 -s $sequence_length -o $OUT_DIR/lsd2_output 2>lsd2_output.log
	/usr/bin/time -v lsd2 -i $OUT_DIR/phylogenetic.tree -d $1.$2.dates.txt -r a -l -1 -u 0 -q 0.2 -R 365 -t 0.00000000010000000000 -v 1 -s $sequence_length -o $OUT_DIR/lsd2_output 2>lsd2_output.log
	update_stats lsd2

	echo $total_time_taken >"$LOG_DIR/total_time.log"
	echo $peak_memory >"$LOG_DIR/memory.log"

	rm -rf cache
	rm -rf minimap2_output.log
	rm -rf viralmsa_output.log
	rm -rf tn93_output.log
	rm -rf fasttree_output.log
	rm -rf lsd2_output.log
	rm -rf $1.fas.sam
}

for r in $(seq 1 $TEST_COUNT); do
	for n in 100 200 300 400; do
		f=$(printf "%02d" $r)
		run_benchmark $n $f
	done
done
