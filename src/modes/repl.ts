import construct_env from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { PackageRequirement, Path, TeaError, utils } from "tea"
import { basename } from "deno/path/mod.ts"
import { gray } from "../utils/Logger.ts"
import exec from "../utils/execve.ts"

export default async function(args: string[], { pkgs, ...opts }: { pkgs: PackageRequirement[], update: boolean | Set<string>, logger: Logger }): Promise<never> {
  const { cmd, PS1 } = shell()

  const pkgenv = await install(pkgs, opts)
  const env = await construct_env(pkgenv)
  const pkgs_str = () => pkgenv.installations.map(({pkg}) => gray(utils.pkg.str(pkg))).join(", ")

  console.error('this is a temporary shell containing the following packages:')
  console.error(pkgs_str())
  console.error("when done type: `exit`")

  if (PS1) env['PS1'] = PS1
  cmd.push(...args)

  exec({ cmd, env })
}

/////////////////////////////////////////////////////////////////////////// utils
function shell() {
  const SHELL = Deno.env.get('SHELL')
  const shell = SHELL?.trim() || find_shell()
  const cmd = [shell, '-i'] // interactive
  let PS1: string | undefined

  //TODO other shells pls #help-wanted

  switch (basename(shell)) {
  case 'bash':
    cmd.splice(1, 0, '--norc', '--noprofile') // longopts must precede shortopts
    // fall through
  case 'sh':
    PS1 = "\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] %~ "
    break
  case 'zsh':
    PS1 = "%F{086}tea%F{reset} %~ "
    cmd.push('--no-rcs', '--no-globalrcs')
    break
  case 'elvish':
    cmd.push(
      '-norc'
    )
    break
  case 'fish':
    cmd.push(
      '--no-config',
      '--init-command',
      'function fish_prompt; set_color 5fffd7; echo -n "tea"; set_color grey; echo " %~ "; end'
      )
  }

  return {cmd, PS1}
}

function find_shell() {
  for (const shell of ['/bin/bash', '/bin/zsh', '/bin/sh']) {
    if (new Path(shell).isExecutableFile()) {
      return shell
  }}
  throw new TeaError("no shell found")
}