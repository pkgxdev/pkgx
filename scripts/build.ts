#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-run
  - --allow-read
  - --allow-write=/opt
  - --allow-env
  - --import-map={{ srcroot }}/import-map.json
---*/

import build from "prefab/build.ts"
import { lvl1 as link } from "prefab/link.ts"
import usePantry from "hooks/usePantry.ts"
import { parsePackageRequirement, semver } from "types"
import { Command } from "cliffy/command/mod.ts"
import { prepare } from "./_shared.ts"

const { args, options: { skipExtract } } = await new Command()
  .name("tea-build")
  .option("--skip-extract", "don’t unzip")
  .arguments("<pkgspec...:string>")
  .parse(Deno.args)

const pantry = usePantry()

//TODO skip untar, skip download etc. flags

for (const req of args[0].map(parsePackageRequirement)) {
  console.debug({ req })
  const versions = await pantry.getVersions(req)
  const version = semver.maxSatisfying(versions, req.constraint)
  if (!version) throw new Error("no-version-found")
  const pkg = { project: req.project, version }
  console.debug(pkg)
  const deps = await pantry.getDeps(pkg)

  console.debug({ deps })

  const prebuild = async () => {
    if (!skipExtract) {
      await prepare(pkg)
    }
  }

  const path = await build({ pkg, deps, prebuild })
  await link({ path, pkg })
}
