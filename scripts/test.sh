#!/usr/bin/env -S tea -E

foo="
---
args: /bin/sh
---
"

deno test \
 --allow-net \
 --allow-read \
 --allow-env=SRCROOT \
 --allow-run \
 --import-map=$SRCROOT/import-map.json \
 tests/*.ts
