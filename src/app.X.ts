import { Args } from "hooks/useFlags.ts"
import { useCellar } from "hooks"
import { handler, prepare_exec_cmd, which } from "./app.exec.ts"
import { panic, run, TeaError, UsageError } from "utils"

export default async function X(opts: Args) {
  const arg0 = opts.args[0]
  if (!arg0) throw new UsageError()

  const found = await which(arg0)

  if (!found) {
    throw new TeaError('not-found: tea -X: arg0', {arg0})
  }

  opts.mode = 'exec'
  opts.pkgs.push({ ...found })

  const { env, pkgs } = await prepare_exec_cmd(opts.pkgs, {env: opts.env ?? false})
  const pkg = pkgs.find(x => x.project == found!.project) ?? panic()
  const install = await useCellar().resolve(pkg)
  const cmd = opts.args
  cmd[0] = install.path.join('bin', found!.shebang).string  // force full path to avoid infinite recursion
  try {
    await run({ cmd, env })
  } catch (err) {
    handler(err)
  }
}
