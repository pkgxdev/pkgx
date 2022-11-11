import { usePantry, useCellar, useFlags, useVirtualEnv } from "hooks"
import useShellEnv, { EnvKeys } from "hooks/useShellEnv.ts"
import { Installation, PackageSpecification } from "types"
import { flatmap, print, undent, pkg } from "utils"
import { isPlainObject, isFullArray } from "is_what"
import { basename } from "deno/path/mod.ts"
import { Args } from "hooks/useFlags.ts"
import { hydrate } from "./app.exec.ts";

//TODO should read from the shell configuration files to get originals properly
//TODO don’t wait on each print, instead chain the promises to be more time-efficient

export default async function dump(args: Args) {
  const { magic } = useFlags()
  const blueprint = await (() => {
    if (args.env || args.env === undefined && magic) {
      // for dump mode it is not an error for there to be no virtual-env
      return useVirtualEnv().swallow("not-found:srcroot")
    }
  })()

  const shell = flatmap(Deno.env.get("SHELL"), basename)
  const [setEnv, unsetEnv]= (() => {
    switch (shell) {
    case "fish":
      return [
        (name: string, val: string) => `set -gx ${name} '${val}';`,
        (name: string) => `set -e ${name};`
      ]
    default:
      return [
        (name: string, val: string) => `export ${name}='${val}'`,
        (name: string) => `unset ${name}`
      ]
  }})()

  // represents the dehydrated initial env
  //FIXME storing in the env is kinda gross
  const defaults = (() => {
    const json = flatmap(Deno.env.get("TEA_REWIND"), x => JSON.parse(x), {rescue: true})
    if (isPlainObject(json)) {
      for (const [key, value] of Object.entries(json)) {
        if (!isFullArray(value)) {
          delete json[key]
        }
      }
      return json as Record<string, string[]>
    } else {
      return EnvKeys.reduce((obj, key) => {
        const value = Deno.env.get(key)
        if (value) {
          obj[key] = value.split(":")
        } else {
          delete obj[key]
        }
        return obj
      }, {} as Record<string, string[]>)
    }
  })()

  const {installations, pending} = await (async () => {
    const cellar = useCellar()
    const installations: Installation[] = []
    const pending: PackageSpecification[] = []
    const pkgs = await hydrate([...args.pkgs, ...blueprint?.requirements ?? []])
    const dry = new Set<string>(pkgs.wet.dry.map(x => x.project))

    for (const rq of pkgs.wet.dry) {
      const installation = await cellar.has(rq)
      if (installation) {
        installations.push(installation)
      } else if (dry.has(rq.project)) {
        /// we only auto-install explicitly requested packages
        pending.push(rq)
      }
    }

    return {installations, pending}
  })()

  if (!blueprint && installations.length == 0 && pending.length == 0) {

    // k we are in a non dev dir, unset everything
    // well, only if TEA_REWIND is set since otherwise we already did that

    if (Deno.env.get("TEA_REWIND")) {
      if (Deno.env.get("TEA_REWIND")!.includes("TEA_PREFIX")) {
        // we do this manually because we also set it for stuff executed through tea
        // which means when developing tea this otherwise doesn’t get unset lol
        await print(unsetEnv("TEA_PREFIX"))
      }

      await print(unsetEnv("TEA_REWIND"))

      for (const key of [...EnvKeys, 'SRCROOT', 'VERSION']) {
        if (defaults[key]) {
          if (neq(defaults[key], Deno.env.get(key)?.split(":"))) {
            await print(setEnv(key, defaults[key].join(":")))
          }
        } else if (Deno.env.get(key) !== undefined) {
          await print(unsetEnv(key))
        }
      }
    }

    return
  }

  if (blueprint?.srcroot) {
    await print(setEnv("SRCROOT", blueprint.srcroot.string))
  } else if (Deno.env.get("SRCROOT")) {
    await print(unsetEnv("SRCROOT"))
  }
  if (blueprint?.version) {
    await print(setEnv("VERSION", blueprint.version.toString()))
  } else if (Deno.env.get("VERSION")) {
    await print(unsetEnv("VERSION"))
  }

  const env = useShellEnv({installations, pending, pristine: true})

  //TODO if PATH is the same as the current PATH maybe don't do it
  // though that makes the behavior of --env --dump very specific

  for (const key of EnvKeys) {
    const value = env[key]
    if (value) {
      if (key == 'PATH' && defaults[key]?.length) {
        value.push(...defaults[key])
      }
      if (value.length) {
        await print(setEnv(key, value.join(":")))
      }
    } else if (Deno.env.get(key) !== undefined) {
      if (!defaults[key]?.chuzzle()) {
        await print(unsetEnv(key))
      } else {
        await print(setEnv(key, defaults[key].join(":")))
      }
    }
  }

  // TODO: implement command-not-found for csh/sh/etc
  if (pending.length) {
    const pantry = usePantry()
    let rv = undefined
    switch (shell) {
    case 'zsh':
      rv = undent`
        command_not_found_handler() {
          case $0 in

        `
      for (const uninstalled of pending) {
        const exes = await pantry.getProvides(uninstalled)
        if (exes.length) {
          const cmds = exes.join("|")
          rv += `    ${cmds}) tea '+${pkg.str(uninstalled)}' "$@";;\n`
        }
      }
      rv += `  *)\n    printf 'zsh: command not found: %s\\n' "$1";;\n  esac\n}`
      break
    case 'fish':
      rv = undent`
        function command_not_found_handler
          switch "$argv[0]"`
      for (const uninstalled of pending) {
        const exes = await pantry.getProvides(uninstalled)
        if (exes.length) {
          const cmds = exes.join(" ")
          rv += `    case ${cmds}; tea '+${pkg.str(uninstalled)}' "$argv"\n`
        }
      }
      rv += "  end\nend"
    }

    if (rv) await print(rv)
  } else {
    //TODO unless there's a default!
    switch (shell) {
      case 'zsh':
        await print("if typeset -f command_not_found_handler >/dev/null; then unset -f command_not_found_handler; fi")
        break
      case 'bash':
        await print("if typeset -f command_not_found_handle >/dev/null; then unset -f command_not_found_handle; fi")
        break
      case 'fish':
        await print("if functions --query command_not_found_handler >/dev/null; functions --erase command_not_found_handler; end")
        break
    }
  }

  await print(setEnv("TEA_REWIND", JSON.stringify(defaults)))
}

function neq(a: string[] | undefined, b: string[] | undefined) {
  if (!a && !b) return false
  if (!a || !b) return true
  if (a.length != b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return true
  }
  return false
}
