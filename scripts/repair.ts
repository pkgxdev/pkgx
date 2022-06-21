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

import repairLinks from "prefab/repair-links.ts"
import { print } from "utils"

print("this because otherwise console.verbose is not defined lol")

for (const project of Deno.args) {
  await repairLinks(project)
}
