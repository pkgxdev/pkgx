#!/bin/sh

SRCROOT=$(cd $(dirname $0)/.. && pwd)
OUTPUT=/usr/local/bin/tea  #FIXME
DENO=deno #FIXME

cat <<EOF> $OUTPUT
#!/bin/sh
PATH=/opt/deno.land/v1/bin:$PATH #FIXME
exec deno \\
  run \\
  --allow-read --allow-write=/opt --allow-net --allow-run --allow-env \\
  --import-map='$SRCROOT/import-map.json' \\
  $SRCROOT/src/app.ts \\
  "\$@"
EOF

chmod u+x $OUTPUT
