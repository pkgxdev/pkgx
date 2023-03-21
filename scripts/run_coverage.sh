#!/bin/bash

set -e

rm -rf cov_profile
deno task test --fail-fast --coverage=cov_profile 
deno coverage cov_profile --lcov --exclude=tests/ --output=cov_profile/coverage_file.lcov
genhtml -o cov_profile cov_profile/coverage_file.lcov
open cov_profile/index.html
