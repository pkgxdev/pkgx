#!/usr/bin/env -S tea -E

_="
---
args: /bin/sh
---
"

ROOTS=$(ls /opt/tea.xyz/var/pantry/projects)

for x in $ROOTS
do
  if [ "X$x" = "X" ]
  then
    continue
  fi
  rm -rf /opt/"$x"
done

rm /opt/tea.xyz/var/www/*.tar.?z