#!/usr/bin/env -S tea -E

/*
---
args:
  - deno
  - run
  - --allow-net
  - --allow-env=TEA_PREFIX,VERBOSE,DEBUG,MAGIC,GITHUB_ACTIONS,JSON,NUMPTY,MUGGLE
  - --allow-read={{ tea.prefix }}
  - --allow-write={{ tea.prefix }}
  - --allow-run  # uses `/bin/ln`
  - --import-map={{ srcroot }}/import-map.json
---
*/

import { useCellar, useFlags } from "hooks"
import { Installation } from "types"
import { link } from "prefab"

if (import.meta.main) {
  useFlags()

  for (const project of Deno.args) {
    await repairLinks(project)
  }
}

export default async function repairLinks(project: string) {
  const cellar = useCellar()
  const installed = await cellar.ls(project)
  const shelf = cellar.shelf(project)

  for await (const [path, {isSymlink}] of shelf.ls()) {
    //FIXME shouldn't delete things we may not have created
    if (isSymlink) path.rm()
  }

  const majors: {[key: number]: Installation[]} = {}

  for (const installation of installed) {
    const {pkg: {version: v}} = installation
    if (!majors[v.major]) majors[v.major] = []
    majors[v.major].push(installation)
  }

  for (const installations of Object.values(majors)) {
    const version = installations
      .map(({pkg: {version}}) => version)
      .sort()
      .slice(-1)[0] // safe bang since we have no empty arrays in above logic

    link({project, version}) //TODO link lvl2 is possible here
  }
}
