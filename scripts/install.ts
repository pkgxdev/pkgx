#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-write=/opt
  - --allow-read
  - --import-map={{ srcroot }}/import-map.json
---*/

import hydrate from "prefab/hydrate.ts"
import install from "prefab/install.ts"
import resolve from "prefab/resolve.ts"
import { lvl1 as link } from "prefab/link.ts"
import { parsePackageRequirement } from "types"
import usePantry from "hooks/usePantry.ts"

await usePantry().update()

const dry = Deno.args.map(parsePackageRequirement);  console.verbose({ received: dry })
const wet = await hydrate(dry);                      console.verbose({ hydrated: wet })
const gas = await resolve(wet);                      console.verbose({ resolved: gas })

for (const pkg of gas) {
  console.info({ installing: pkg })
  const installation = await install(pkg)
  await link(installation)
}
