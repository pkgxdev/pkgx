import { EnvKeys } from "hooks/useShellEnv.ts"
import { flatmap, print } from "utils"
import { isPlainObject, isFullArray, isEmptyObject } from "is_what"
import { basename } from "deno/path/mod.ts"
import Path from "./vendor/Path.ts"
import { Installation } from "types"

//TODO should read from the shell configuration files to get originals properly
//TODO don’t wait on each print, instead chain the promises to be more time-efficient

interface Parameters {
  args: string[]
  env: Record<string, string>
  pkgs: Installation[]
  stack_mode: boolean
}

export default async function dump({ args, env, pkgs, stack_mode}: Parameters) {
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
  const defaults = get_defaults()
  const keys = new Set([...EnvKeys, 'SRCROOT', 'VERSION', 'TEA_FILE', ...Object.keys(env)])

  if (pkgs.length == 0 && stack_mode) {
    // this is shell magic mode and we need to reset the shell env to pristine defaults

    if (Deno.env.get("TEA_REWIND")?.includes("TEA_PREFIX")) {
      // we do this manually because we also set it for stuff executed through tea
      // which means when developing tea this otherwise doesn’t get unset lol
      await print(unsetEnv("TEA_PREFIX"))
    }

    if (Deno.env.get("TEA_REWIND")) {
      await print(unsetEnv("TEA_REWIND"))
    }

    for (const key of keys) {
      if (defaults[key]) {
        if (neq(defaults[key], Deno.env.get(key)?.split(":"))) {
          await print(setEnv(key, defaults[key].join(":")))
        }
      } else if (Deno.env.get(key) !== undefined) {
        await print(unsetEnv(key))
      }
    }
  } else {
    for (const key of keys) {
      const value = env[key]
      if (value?.chuzzle()) {
        await print(setEnv(key, value))
      } else if (Deno.env.get(key) !== undefined) {
        if (!defaults[key]?.chuzzle()) {
          await print(unsetEnv(key))
        } else {
          const joined = defaults[key].join(":")
          const current = Deno.env.get(key)?.trim()
          if (joined != current) {
            await print(setEnv(key, defaults[key].join(":")))
          } else {
            delete defaults[key]
          }
        }
      }
    }

    if (stack_mode && !isEmptyObject(defaults)) {
      await print(setEnv("TEA_REWIND", JSON.stringify(defaults)))
    } else if (Deno.env.get("TEA_REWIND") !== undefined) {
      await print(unsetEnv("TEA_REWIND"))
    }
  }

  if (args.length) {
    /// misleading but otherwise our dry-run info is not as useful
    const fullpath = which(args[0], env["PATH"])
    if (fullpath) args[0] = fullpath

    await print("")
    await print(args.join(" "))
  }
}

function which(arg0: string, PATH: string | undefined) {
  for (const piece of PATH?.split(":") ?? []) {
    const exefile = Path.cwd().join(piece, arg0)
    if (exefile.isExecutableFile()) {
      return exefile.string
    }
  }
  return arg0
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

function get_defaults() {
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
}
