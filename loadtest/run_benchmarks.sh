#!/usr/bin/env bash
set -e

echo "🚀 [Flash Sale Platform] Starting Benchmark Execution Suite..."
echo "📍 Target Backend URL: http://localhost:8080/query"

# 1. Ramp-up Benchmark
echo -e "\n--------------------------------------------------"
echo "📈 [1/3] Executing Scenario: Ramp-Up (Gradual Increase)"
echo "--------------------------------------------------"
k6 run loadtest/ramp_up.js

# 2. Sudden Spike Benchmark
echo -e "\n--------------------------------------------------"
echo "⚡ [2/3] Executing Scenario: Sudden Spike (Thundering Herd)"
echo "--------------------------------------------------"
k6 run loadtest/sudden_spike.js

# 3. Flash Sale Blitz Benchmark
echo -e "\n--------------------------------------------------"
echo "🔥 [3/3] Executing Scenario: Flash Sale Blitz (Limited Stock War)"
echo "--------------------------------------------------"
k6 run loadtest/flash_sale_blitz.js

echo -e "\n✅ All Benchmark Scenarios Completed Successfully!"
