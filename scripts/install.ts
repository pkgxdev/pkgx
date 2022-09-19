#!/usr/bin/env -S tea -E

// returns all pantry entries as `[{ name, path }]`

/*---
args:
  - deno
  - run
  - --allow-env
  - --allow-read
  - --allow-write
  - --import-map={{ srcroot }}/import-map.json
  - --allow-net
  - --allow-run
---*/

import { lvl1 as link } from "prefab/link.ts"
import install from "prefab/install.ts"
import { parsePackageRequirement } from "types"
import resolve from "prefab/resolve.ts"
import useFlags from "hooks/useFlags.ts"

useFlags()

const pkgs = Deno.args.map(project => {
  const match = project.match(/projects\/(.+)\/package.yml/)
  return match ? match[1] : project
}).map(parsePackageRequirement)

// resolve and install precise versions that are available in available inventories
for await (const pkg of await resolve(pkgs)) {
  console.log({ installing: pkg.project })
  const installation = install(pkg)
  await link(installation)
}
