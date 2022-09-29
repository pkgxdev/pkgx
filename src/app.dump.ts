import { Installation, PackageRequirement } from "types"
import { useShellEnv, usePantry, useCellar } from "hooks"
import { VirtualEnv } from "hooks/useVirtualEnv.ts"
import { print, undent } from "utils"

interface Options {
  env: VirtualEnv | undefined
}

//TODO needs to take a argish parameter

export default async function dump({ env: blueprint }: Options) {
  console.verbose({ blueprint })

  const shell = Deno.env.get("SHELL")?.split('/').pop()
  const [ setEnv, unsetEnv ]= (() => {
    switch (shell) {
    case "fish":
      return [
        (name: string, val: string) => `set -gx ${name} ${val};`,
        (name: string) => `set -e ${name};`
      ]
    default:
      return [
        (name: string, val: string) => `export ${name}=${val}`,
        (name: string) => `unset ${name}`
      ]
  }})()
  if (blueprint?.srcroot) {
    await print(setEnv("SRCROOT", blueprint.srcroot.string))
  } else if (Deno.env.get("SRCROOT")) {
    await print(unsetEnv("SRCROOT"))
  }

  const {installations, pending} = await (async () => {
    const cellar = useCellar()
    const installations: Installation[] = []
    const pending: PackageRequirement[] = []

    for (const rq of blueprint?.requirements ?? []) {
      const installation = await cellar.has(rq)
      if (installation) {
        installations.push(installation)
      } else {
        pending.push(rq)
      }
    }
    return {installations, pending}
  })()

  const { combinedStrings: vars } = useShellEnv(installations)

  //TODO if PATH is the same as the current PATH maybe don't do it
  // though that makes the behavior of --env --dump very specific

  for (const [key, value] of Object.entries(vars)) {
    await print(value
      ? setEnv(key, value)
      : unsetEnv(key))
  }
  if (blueprint?.version) {
    await print(setEnv("VERSION", blueprint.version.toString()))
  }

  // TODO: implement command-not-found for fish
  if (shell !== "fish") { return }

  if (pending.length) {
    const pantry = usePantry()
    let rv = undent`
      command_not_found_handler() {
        case $0 in

      `
    for (const pkg of pending) {
      const cmds = (await pantry.getProvides(pkg)).join("|")
      rv += `    ${cmds}) tea -xmP ${pkg.project}@'${pkg.constraint}' -- "$@";;\n`
    }
    rv += `  *)\n    printf 'zsh: command not found: %s\\n' "$1";;\n  esac\n}`

    await print(rv)
  } else {
    //TODO unless there's a default!
    await print("if typeset -f command_not_found_handler >/dev/null; then unset -f command_not_found_handler; fi")
  }
}
