import { useConfig, useRun, useLogger, RunError, Verbosity, ExitError } from "hooks"
import { Installation, Path, utils, TeaError } from "tea"
import { basename } from "deno/path/mod.ts"
import { isNumber } from "is-what"
import execle from "./utils/execle.ts"

export default async function(cmd: string[], env: Record<string, string>) {
  const { TEA_FORK_BOMB_PROTECTOR } = useConfig().env
  const { red, teal } = useLogger()

  // ensure we cannot fork bomb the user since this is basically the worst thing tea/cli can do
  let nobomb = parseInt(TEA_FORK_BOMB_PROTECTOR ?? '0').chuzzle() ?? 0
  env['TEA_FORK_BOMB_PROTECTOR'] = `${++nobomb}`
  if (nobomb > 20) throw new Error("FORK BOMB KILL SWITCH ACTIVATED")

  try {
    await useRun({cmd, env})
  } catch (err) {
    const debug = useConfig().modifiers.verbosity >= Verbosity.debug
    const arg0 = cmd?.[0]

    if (err instanceof TeaError) {
      throw err
    } else if (debug) {
      console.error(err)
    } else if (err instanceof Deno.errors.NotFound) {
      console.error("tea: command not found:", teal(arg0))
      throw new ExitError(127)  // 127 is used for command not found
    } else if (err instanceof Deno.errors.PermissionDenied) {
      if (Path.abs(arg0)?.isDirectory()) {
        console.error("tea: is directory:", teal(arg0))
      } else {
        console.error("tea: permission denied:", teal(arg0))
      }
    } else if (err instanceof RunError == false) {
      const decapitalize = ([first, ...rest]: string) => first.toLowerCase() + rest.join("")
      console.error(`${red("error")}:`, decapitalize(err.message))
    }
    const code = err?.code ?? 1
    throw new ExitError(isNumber(code) ? code : 1)
  }
}

export async function repl(installations: Installation[], env: Record<string, string>) {
  const { SHELL } = useConfig().env
  const { gray } = useLogger()
  const pkgs_str = () => installations.map(({pkg}) => gray(utils.pkg.str(pkg))).join(", ")

  // going to stderr so that we don’t potentially break (nonsensical) pipe scenarios, eg.
  //     tea -E | env
  // python etc. have the same behavior
  console.error('this is a temporary shell containing the following packages:')
  console.error(pkgs_str())
  console.error("when done type: `exit'")

  const shell = SHELL?.trim() || "/bin/sh"
  const cmd = [shell, '-i'] // interactive

  //TODO other shells pls #help-wanted

  switch (basename(shell)) {
  case 'bash':
    cmd.splice(1, 0, '--norc', '--noprofile') // longopts must precede shortopts
    // fall through
  case 'sh':
    env['PS1'] = "\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] %~ "
    break
  case 'zsh':
    env['PS1'] = "%F{086}tea%F{reset} %~ "
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

  execle(cmd[0], cmd, env)
}
