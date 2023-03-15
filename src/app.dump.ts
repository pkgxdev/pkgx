import { flatmap, print } from "utils"
import { isPlainObject } from "is_what"

//TODO should read from the shell configuration files to get originals properly
//TODO don’t wait on each print, instead chain the promises to be more time-efficient

interface Parameters {
  env: Record<string, string>
  shell?: string
}

export default async function dump({ env, shell }: Parameters) {
  const [set, unset]= (() => {
    switch (shell) {
    case "elvish":
      return [
        (name: string, val: string) => `set-env ${name} '${val}'`,
        (name: string) => `unset-env ${name}`
      ]
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
    }
  })()

  const is_env = env['SRCROOT']

  if (is_env) {
    const oldenv = Deno.env.toObject()

    // first rewind the env to the original state
    if (oldenv['TEA_REWIND']) {
      const rewind = JSON.parse(oldenv['TEA_REWIND']) as { revert: Record<string, string>, unset: string[] }
      delete oldenv['TEA_REWIND']

      for (const key of rewind.unset) {
        if (!env[key]) {
          await print(unset(key))
        }
        delete oldenv[key]
      }
      for (const [key, value] of Object.entries(rewind.revert)) {
        if (!env[key]) {
          await print(set(key, value))
        }
        oldenv[key] = value
      }
    }

    // now calculate the new rewind
    const TEA_REWIND = (() => {
      const revert: Record<string, string> = {}
      const unset: string[] = []
      for (const key of Object.keys(env)) {
        const value = oldenv[key]?.trim()
        if (value) {
          revert[key] = value
        } else {
          unset.push(key)
        }
      }
      return JSON.stringify({
        revert, unset
      })
    })()

    // print the setters for the new env
    for (const [key, value] of Object.entries(env)) {
      await print(set(key, value))
    }
    await print(set('TEA_REWIND', TEA_REWIND))

  } else {
    const unwind = flatmap(Deno.env.get('TEA_REWIND'), JSON.parse) as { revert: Record<string, string>, unset: string[] }
    if (!isPlainObject(unwind)) return

    for (const key of unwind.unset) {
      await print(unset(key))
    }
    for (const [key, value] of Object.entries(unwind.revert)) {
      await print(set(key, value))
    }
    await print(unset('TEA_REWIND'))
  }
}
