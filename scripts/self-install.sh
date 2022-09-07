#!/bin/bash

set -exo pipefail

#FIXME we should use the correct version of deno

TEA_BIN=$(which tea)

if test -L "$TEA_BIN"; then
  TEA_BIN="$(readlink "$TEA_BIN")"
fi

TEA_PREFIX="$(cd $(dirname "$TEA_BIN")/../../.. && pwd)"
OUTDIR="$TEA_PREFIX/tea.xyz/v*"
OUTPUT="$OUTDIR/bin/tea"

if test -L "$OUTDIR"; then
  # usually, this is a symlink
  rm "$OUTDIR"
fi

if ! test -d "$OUTDIR"; then
  mkdir -p "$OUTDIR"/bin
fi

SRCROOT="$(cd $(dirname "$0")/.. && pwd)"

cat <<EOF> "$OUTPUT"
#!/bin/sh

if test -L "\$0"; then
  TEA_BIN="\$(readlink \$0)"
else
  TEA_BIN="\$0"
fi

TEA_PREFIX=\$(cd \$(dirname "\$TEA_BIN")/../../.. && pwd)
SRC_PREFIX="$SRCROOT"

exec \$TEA_PREFIX/deno.land/v1/bin/deno \
  run \
  --allow-read \\
  --allow-write="\$TEA_PREFIX" \\
  --allow-net \\
  --allow-run \\
  --allow-env \
  --import-map="\$SRC_PREFIX"/import-map.json \
  "\$SRC_PREFIX"/src/app.ts \
  "\$@"
EOF

chmod u+x "$OUTPUT"
