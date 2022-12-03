import { Args } from "hooks/useFlags.ts"
import { useCellar, usePantry } from "hooks"
import * as semver from "semver"
import { prepare_exec_cmd } from "./app.exec.ts"
import { panic, run, TeaError, UsageError } from "utils"

export default async function X(opts: Args) {
  const arg0 = opts.args[0]
  if (!arg0) throw new UsageError()

  let found: { project: string } | undefined

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
  opts.pkgs.push({ ...found, constraint: new semver.Range('*') })

  const { env, pkgs } = await prepare_exec_cmd(opts.pkgs, {env: opts.env ?? false})
  const pkg = pkgs.find(x => x.project == found!.project) ?? panic()
  const install = await useCellar().resolve(pkg)
  const cmd = opts.args
  cmd[0] = install.path.join('bin', arg0).string  // force full path to avoid infinite recursion
  await run({ cmd, env })
}
