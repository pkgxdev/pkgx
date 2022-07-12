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
import { join } from "deno/path/mod.ts";

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

export async function* lsPantry(path = ""): AsyncGenerator<string, void, void> {
  for await (const p of Deno.readDir(`/opt/tea.xyz/var/pantry/projects/${path}`)) {
    if (p.name === "package.yml") {
      yield path
    } else if (p.isDirectory) {
      for await (const p1 of lsPantry(join(path, p.name))) {
        if (p1) { yield p1 }
      }
    }
  }
}
