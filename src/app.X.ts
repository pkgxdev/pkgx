import { Args } from "hooks/useFlags.ts"
import { usePantry } from "hooks"
import * as semver from "semver"
import exec from "./app.exec.ts"
import { TeaError, UsageError } from "utils"

export default async function X(opts: Args) {
  const arg0 = opts.args[0]
  if (!arg0) throw new UsageError()

  let found: { project: string } | undefined | true

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
    throw new TeaError('not-found: tea -X: arg0', {arg0})
  }

  opts.mode = 'exec'
  if (found !== true && found) {
    opts.pkgs.push({ ...found, constraint: new semver.Range('*') })
  }

  await exec(opts)
}
