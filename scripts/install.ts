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
  - --unstable
---*/

import { link, install, resolve } from "prefab"
import { useFlags } from "hooks"
import { pkg } from "utils"

useFlags()

const force = !!Deno.env.get("FORCE")

const rqs = Deno.args.map(project => {
  const match = project.match(/projects\/(.+)\/package.yml/)
  return match ? match[1] : project
}).map(pkg.parse)

const { pending, installed } = await resolve(rqs)

if (!force && installed.length) {
  console.info({'already-installed': installed})
}

const pkgs = force ? [...installed.map(x=>x.pkg), ...pending] : pending

// resolve and install precise versions that are available in available inventories
for (const pkg of pkgs) {
  const installation = await install(pkg)
  await link(installation)
}
