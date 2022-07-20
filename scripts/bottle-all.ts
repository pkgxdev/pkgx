#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-run
  - --allow-read=/opt
  - --allow-write=/opt
  - --allow-env=GITHUB_TOKEN
  - --import-map={{ srcroot }}/import-map.json
---*/

import usePantry from "hooks/usePantry.ts"
import { bottle, lsPantry } from "./_shared.ts";
import { semver } from "types";
import useCellar from "hooks/useCellar.ts";

const pantry = usePantry();

for await (const project of lsPantry()) {
  console.log({project})
  const versions = await pantry.getVersions({ project, constraint: new semver.Range('*') })
  const reqs = new Set(versions.map(v => `${v.major}.${v.minor}`))
  for (const req of reqs) {
    const version = { project: project, constraint: new semver.Range(req) }
    if (!await useCellar().isInstalled(version)) { continue }
    try {
      await bottle(version)
    } catch (error) {
      console.verbose({ couldntBottle: { project, version }, error })
    }
  }
}
