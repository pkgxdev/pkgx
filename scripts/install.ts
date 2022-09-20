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

import { link, install, resolve } from "prefab"
import { parse_pkg_requirement } from "utils"
import { useFlags } from "hooks"

useFlags()

const pkgs = Deno.args.map(project => {
  const match = project.match(/projects\/(.+)\/package.yml/)
  return match ? match[1] : project
}).map(parse_pkg_requirement)

// resolve and install precise versions that are available in available inventories
for await (const pkg of await resolve(pkgs)) {
  console.log({ installing: pkg.project })
  const installation = await install(pkg)
  await link(installation)
}
