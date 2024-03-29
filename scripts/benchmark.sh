#!/usr/bin/env bash

# This script needs to be executed with dev off

set -e

export GIT_VERSION="2.44.0"

for deno_version in 1.40 1.41 1.42; do
  echo "Compiling with deno@${deno_version}..."
  pkgx "deno@${deno_version}" task compile 2>/dev/null

  ./pkgx "git@${GIT_VERSION}" --version >/dev/null

  echo "Benchmarking..."
  # Use the same deno version for running the benchmark itself
  for _i in {1..10}; do
    pkgx "deno@1.42" bench --allow-run --allow-env --seed=250 benchmarks 2>/dev/null | grep "faster than"
  done
done
