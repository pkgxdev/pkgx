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
import { bottle } from "./bottle.ts";
import { semver } from "types";
import useCellar from "hooks/useCellar.ts";

const pantry = usePantry();

const projects = await pantry.ls()

for await (const project of projects) {
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
