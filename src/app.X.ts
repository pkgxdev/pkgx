import { Args } from "hooks/useFlags.ts"
import { usePantry } from "hooks"
import * as semver from "semver"
import exec from "./app.exec.ts"
import { undent } from "utils"
import Path from "./vendor/Path.ts"

export default async function X(opts: Args) {
  const arg0 = opts.args[0]
  if (!arg0) throw new Error("usage")

  let found: { project: string } | undefined | true

  for (const path of Deno.env.get("PATH")?.split(":") ?? []) {
    console.log(path)
    if (path.startsWith("/") && new Path(path).join(arg0).isExecutableFile()) {
      found = true
      break
    }
  }

  const pantry = usePantry()
  for await (const entry of pantry.ls()) {
    if (found) break
    pantry.getProvides(entry).then(provides => {
      if (!found && provides.includes(arg0)) {
        found = entry
      }
    })
  }

  if (!found) {
    throw new Error(undent`
      couldn’t find a pkg to provide: ${arg0}

      open a pull-request to add it to the pantry:

          https://github.com/teaxyz/pantry.extra
      `)
  }

  opts.mode = 'exec'
  if (found !== true && found) {
    opts.pkgs.push({ ...found, constraint: new semver.Range('*') })
  }

  await exec(opts)
}
