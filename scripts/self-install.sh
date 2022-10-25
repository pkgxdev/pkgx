#!/bin/bash
# requirements: TEA_PREFIX has `deno` or `deno` is in the `PATH`

set -exo pipefail

if test -f /usr/local/bin/tea; then
  echo "/usr/local/bin/tea already exists" >&2
  exit 1
fi

SRCROOT="$(cd $(dirname "$0")/.. && pwd)"

mkdir -p usr/local/bin

cat <<EOF > /usr/local/bin/tea
#!/bin/sh

if test -z "\$TEA_PREFIX"; then
  TEA_PREFIX="\$HOME/.tea"
fi

if test -f "\$TEA_PREFIX/deno.land/v*/bin/deno"; then
  DENO="\$TEA_PREFIX/deno.land/v*/bin/deno"
else
  DENO="deno"
fi

exec "\$DENO" \\
  run \\
  --allow-read \\
  --allow-write \\
  --allow-net \\
  --allow-run \\
  --allow-env \\
  --unstable \\
  --import-map="$SRCROOT"/import-map.json \\
  "$SRCROOT"/src/app.ts \\
  "\$@"
EOF

chmod ugo+x /usr/local/bin/tea
