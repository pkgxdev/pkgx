#!/usr/bin/env bash

# This script needs to be executed with dev off

set -e

for deno_version in 1.40 1.41 1.42; do
  echo "Compiling with deno@${deno_version}..."
  pkgx "deno@${deno_version}" task compile

  echo "Benchmarking compiled binary..."
  # Use the same deno version for running the benchmark itself
  pkgx "deno@1.42" bench --allow-run --allow-env --seed=250 benchmarks
done
