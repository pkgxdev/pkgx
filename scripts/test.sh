#!/usr/bin/env -S tea -E

_="
---
args: /bin/sh
---
"

## Needed for GHA
export TMPDIR=${TMPDIR:-/tmp}

deno test \
 --allow-net \
 --allow-read \
 --allow-env=SRCROOT,GITHUB_TOKEN,TMPDIR \
 --allow-run \
 --import-map=$SRCROOT/import-map.json \
 --allow-write="$TMPDIR" \
 tests/*.ts

# /tmp is required on GHA ¯\_(ツ)_/¯
