#!/usr/bin/env -S tea -E

/*
---
args:
  - deno
  - run
  - --allow-net
  - --allow-read=/opt
  - --allow-write=/opt
  - --import-map={{ srcroot }}/import-map.json
---
*/

import { parsePackageRequirement } from "types"
import useCellar from "hooks/useCellar.ts"
import repairLinks from "prefab/repair-links.ts"

const pkgs = Deno.args.map(parsePackageRequirement);  console.verbose({ received: pkgs })
const { resolve } = useCellar()

for (const pkg of pkgs) {
  console.info({ uninstalling: pkg })
  const installation = await resolve(pkg)
  installation.path.rm({ recursive: true })
  await repairLinks(pkg.project)  //FIXME this is overkill, be precise
}
