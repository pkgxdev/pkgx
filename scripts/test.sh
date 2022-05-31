#!/usr/bin/env -S tea -E

foo="
---
args: /bin/sh
---
"

if [ `uname` == "Darwin" ]; then
  sudo spctl --add /opt/deno.land/v'*'/bin/deno
fi

exec deno test \
 --allow-net \
 --allow-read \
 --allow-env=SRCROOT \
 --allow-run \
 --import-map=$SRCROOT/import-map.json \
 tests/*.ts
