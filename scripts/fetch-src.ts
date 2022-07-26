#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-run
  - --allow-read=/opt
  - --allow-write=/opt
  - --allow-env
  - --import-map={{ srcroot }}/import-map.json
---*/

import usePantry from "hooks/usePantry.ts"
import useCache from "hooks/useCache.ts"
import useCellar from "hooks/useCellar.ts"
import useSourceUnarchiver from "hooks/useSourceUnarchiver.ts"
import { parsePackageRequirement, semver } from "types"
import { Command } from "cliffy/command/mod.ts"
import { print } from "utils"

const { args } = await new Command()
  .name("tea-fetch-src")
  .arguments("<pkgspec:string>")
  .parse(Deno.args)

const pantry = usePantry()
const req = parsePackageRequirement(args[0])
const versions = await pantry.getVersions(req)
const version = semver.maxSatisfying(versions, req.constraint)
if (!version) throw "no-version-found"
const pkg = { project: req.project, version };     console.debug(pkg)

const dstdir = useCellar().mkpath(pkg).join("src")
const { url, stripComponents } = await pantry.getDistributable(pkg)
const { download } = useCache()
const zip = await download({ pkg, url, type: 'src' })
await useSourceUnarchiver().unarchive({
  dstdir,
  zipfile: zip,
  stripComponents
})

await print(`${dstdir}\n`)
