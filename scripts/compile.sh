#!/usr/bin/env bash

# this is only available when using pkgx's deno
DENORT_BIN="$(dirname "$(which deno)")/denort"

if [[ -f "$DENORT_BIN" ]]; then
  export DENORT_BIN
else
  unset DENORT_BIN
fi

exec deno compile --lock=deno.lock --allow-read --allow-write --allow-net \
  --allow-run --allow-env --allow-ffi --unstable-ffi --unstable-fs \
  --output "$INIT_CWD/pkgx" ./entrypoint.ts
