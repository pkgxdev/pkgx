#!/bin/bash

set -exo pipefail

#FIXME we should use the correct version of deno

OUTDIR="$(tea --prefix)/tea.xyz/v*"
OUTPUT="$OUTDIR/bin/tea"
SRCROOT="$(cd $(dirname "$0")/.. && pwd)"

if test -L "$OUTDIR"; then
  # usually, this is a symlink
  rm "$OUTDIR"
fi

mkdir -p "$OUTDIR"/bin

cat <<EOF> "$OUTPUT"
#!/bin/sh

if test -L "\$0"; then
  TEA_EXENAME="\$(readlink \$0)"
else
  TEA_EXENAME="\$0"
fi

if test -z "\$TEA_PREFIX"; then
  TEA_PREFIX=\$(cd \$(dirname "\$TEA_EXENAME")/../../.. && pwd)
fi

SRC_PREFIX="$SRCROOT"

export TEA_PREFIX

exec \$TEA_PREFIX/deno.land/v1/bin/deno \\
  run \\
  --allow-read \\
  --allow-write="\$TEA_PREFIX" \\
  --allow-net \\
  --allow-run \\
  --allow-env \\
  --import-map="\$SRC_PREFIX"/import-map.json \\
  "\$SRC_PREFIX"/src/app.ts \\
  "\$@"
EOF

chmod ugo+x "$OUTPUT"
