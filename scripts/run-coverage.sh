#!/usr/bin/env -S pkgx +genhtml +deno bash

# TODO use git to determine file changes and open those reports

set -eo pipefail

rm -rf cov_profile
deno task test --fail-fast --coverage=cov_profile
deno coverage cov_profile --lcov --exclude=tests/ --output=cov_profile/coverage_file.lcov
genhtml -o cov_profile cov_profile/coverage_file.lcov

if test "$1" != "--reload"; then
  open cov_profile/index.html
else
  osascript -e 'tell application "Safari" to tell the current tab of the front window to do JavaScript "location.reload()"'
fi
