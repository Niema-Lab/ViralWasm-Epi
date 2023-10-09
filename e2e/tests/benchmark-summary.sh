TEST_COUNT=20

cd ../../benchmarks

for p in chromium cli; do
	for n in 100 200 400 1000 2000 4000; do
		average_memory=0
		average_time=0
		for r in $(seq 1 $TEST_COUNT); do
			cd "$n.$r/$p"
			memory=$(cat memory.log)
			average_memory=$(echo "$memory + $average_memory" | bc)
			time=$(cat time.log)
			average_time=$(echo "$time + $average_time" | bc)
			cd ../../
		done
		average_memory=$(echo "$average_memory / 10" | bc)
		average_time=$(echo "scale=3; $average_time / 10" | bc)
		echo "$p $n sequences, average runtime: $average_time seconds, average peak memory: $average_memory KB" >> summary.log
	done
done
