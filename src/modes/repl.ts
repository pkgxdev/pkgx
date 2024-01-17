import construct_env from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { PackageRequirement, Path, PkgxError, utils } from "pkgx"
import { basename } from "deno/path/mod.ts"
import { dim } from "../utils/color.ts"
import exec from "../utils/execve.ts"

export default async function(args: string[], { pkgs, ...opts }: { pkgs: PackageRequirement[], update: boolean | Set<string>, logger: Logger }): Promise<never> {
  const { cmd, PS1 } = shell()

  const pkgenv = await install(pkgs, opts)
  const env = await construct_env(pkgenv)
  const pkgs_str = () => pkgenv.installations.map(({pkg}) => dim(utils.pkg.str(pkg))).join(", ")

  for (const key in env) {
    env[key] = env[key].replaceAll(new RegExp(`\\\${${key}.*?}`, 'g'), (v => v ? `:${v}` : '')(Deno.env.get(key)))
  }

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
    PS1 = "\\[\\033[38;5;63m\\]pkgx\\[\\033[0m\\] %~ "
    break
  case 'zsh':
    PS1 = "%F{086}pkgx%F{reset} %~ "
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
      'function fish_prompt; set_color 5fffd7; echo -n "pkgx"; set_color grey; echo " %~ "; end'
      )
  }

  return {cmd, PS1}
}

function find_shell() {
  for (const shell of ['/bin/bash', '/bin/zsh', '/bin/sh']) {
    if (new Path(shell).isExecutableFile()) {
      return shell
  }}
  throw new PkgxError("no shell found")
}