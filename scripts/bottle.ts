#!/usr/bin/env -S tea -E

/* ---
args:
  - deno
  - run
  - --allow-net
  - --allow-run
  - --allow-read=/opt/
  - --allow-write=/opt/
  - --import-map={{ srcroot }}/import-map.json
--- */

import { parsePackageRequirement } from "types"
import { bottle } from "./_shared.ts"

for (const req of Deno.args.map(parsePackageRequirement)) {
  await bottle(req)
}
