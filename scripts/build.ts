#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-write=/opt
  - --allow-read
  - --allow-env=HOME,VERBOSE,DEBUG,MUGGLE,PATH,MANPATH,PKG_CONFIG_PATH
  - --allow-run
  - --import-map={{ srcroot }}/import-map.json
---*/

import hydrate from "prefab/hydrate.ts"
import build from "prefab/build.ts"
import { lvl1 as link } from "prefab/link.ts"
import usePantry from "hooks/usePantry.ts"
import useCache from "hooks/useCache.ts"
import useCellar from "hooks/useCellar.ts"
import useSourceUnarchiver from "hooks/useSourceUnarchiver.ts"
import { parsePackageRequirement, semver, Package } from "types"
import { Command } from "cliffy/command/mod.ts"

const { args, options: { skipExtract } } = await new Command()
  .name("tea-build")
  .option("--skip-extract", "don’t unzip")
  .arguments("<pkgspec...:string>")
  .parse(Deno.args)

const pantry = usePantry()

//TODO skip untar, skip download etc. flags

for (const req of args[0].map(parsePackageRequirement)) {
  console.debug({hi: req})
  const versions = await pantry.getVersions(req)
  const version = semver.maxSatisfying(versions, req.constraint)
  if (!version) throw "no-version-found"
  const pkg = { project: req.project, version }
  console.debug(pkg)
  const deps = await pantry.getDeps({ pkg, wbuild: true })
  const graph = await hydrate(deps)

  console.debug(deps, graph)

  if (!skipExtract) {
    await prepare(pkg)
  }

  const path = await build({ pkg, deps: graph })
  await link({ path, pkg })
}

async function prepare(pkg: Package) {
  const dstdir = useCellar().mkpath(pkg).join("src")
  const { url, stripComponents } = await pantry.getDistributable(pkg)
  const { download } = useCache()
  const zip = await download({ pkg, url })
  await useSourceUnarchiver().unarchive({
    dstdir,
    zipfile: zip,
    stripComponents
  })
}
