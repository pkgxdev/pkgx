#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-env=SRCROOT
  - --allow-read=/usr/local/bin/tea
  - --allow-write=/usr/local/bin/tea
  - --import-map={{ srcroot }}/import-map.json
---*/

import { Path } from "types"
import { undent } from "utils"

//TODO version of deno should be determined from the requirements file
//TODO /usr/local/bin not world writable by default on linux

const srcroot = Deno.env.get("SRCROOT")!
const exefile = Path.root.join("usr/local/bin/tea")
const text = undent`
  #!/bin/sh
  exec /opt/deno.land/v'*'/bin/deno \\
    run \\
    --allow-read --allow-write=/opt --allow-net --allow-run --allow-env \\
    --import-map='${srcroot}'/import-map.json \\
    '${srcroot}'/src/app.ts \\
    "$@"
  `

exefile.write({ force: true, text }).chmod(0o555)
