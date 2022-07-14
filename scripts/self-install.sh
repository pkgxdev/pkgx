#!/bin/sh

DENO=/opt/deno.land/v1/bin/deno  #FIXME
SRCROOT=$(cd $(dirname $0)/.. && pwd)
OUTPUT=/usr/local/bin/tea  #FIXME

cat <<EOF> $OUTPUT
#!/bin/sh
exec $DENO \\
  run \\
  --allow-read --allow-write=/opt --allow-net --allow-run --allow-env \\
  --import-map='$SRCROOT/import-map.json' \\
  $SRCROOT/src/app.ts \\
  "\$@"
EOF

chmod u+x /usr/local/bin/tea
