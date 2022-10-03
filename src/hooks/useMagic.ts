import { usePackageYAMLFrontMatter, useExecutableMarkdown, useCache } from "hooks"
import useFlags, { ReturnValue, Mode } from "hooks/useFlags.ts"
import useVirtualEnv, { VirtualEnv } from "hooks/useVirtualEnv.ts"
import { PackageSpecification } from "types"
import { flatmap } from "utils"
import Path from "path"
import * as semver from "semver"

type Args = Omit<ReturnValue, 'cd'>

export type ProcessedArgs = {
  mode: Mode
  args: string[]
  env: VirtualEnv | undefined
  pkgs: PackageSpecification[]  // env.pkgs + explicit on CLI + YAML front matter etc.
}

export default async function useMagic(input: Args): Promise<ProcessedArgs> {
  return await (useFlags().muggle ? muggle : magic)(input)
}

async function muggle(input: Args): Promise<ProcessedArgs> {
  if (!input.mode) throw "muggles must specify execution mode"

  const script = await (async () => {
    const arg0 = input.args.std[0]
    try {
      const url = new URL(arg0)
      if (url.protocol == 'file') return new Path(url.pathname)
      return await useCache().download({ type: 'script', url })
    } catch {
      return Path.cwd().join(arg0).isFile()
    }
  })()

  const env = input.args.env ? await useVirtualEnv() : undefined

  const [args, pkgs] = await (async () => {
    if (!script) return [
      mkargs(input),
      env?.requirements ?? []
    ]

    const yaml = await usePackageYAMLFrontMatter(script, env?.srcroot).swallow("no-front-matter")

    return [
      [...yaml?.getArgs() ?? [], ...mkargs(input)],
      [...yaml?.getDeps(false) ?? [], ...env?.requirements ?? [], ...input.args.pkgs]
    ]
  })()

  return {
    mode: input.mode,
    args, env, pkgs
  }
}

async function magic(input: Args): Promise<ProcessedArgs> {
  const mode = input.mode ?? 'exec'
  const arg0 = input.args.std[0]

  const script = await (async () => {
    try {
      const url = new URL(arg0)
      if (url.protocol == 'file') return new Path(url.pathname)
      return await useCache().download({type: 'script', url})
    } catch {
      return Path.cwd().join(arg0).isFile()
    }
  })()

  let env: VirtualEnv | undefined
  if (input.args.env) {
    const cwd = script ? script.parent() : Path.cwd()
    env = await useVirtualEnv({ cwd })
    if (!env) throw "no env found"
  }

  const pkgs = [...env?.requirements ?? [], ...input.args.pkgs]

  if (script) {
    //NOTE if you specify a script it won’t add the env automatically—even if there’s one present

    const yaml = await usePackageYAMLFrontMatter(script, env?.srcroot).swallow("no-front-matter")

    if (yaml) {
      pkgs.push(...yaml.getDeps(false))
      const args = [...yaml.getArgs(), ...mkargs(input)]
      return { mode, args, pkgs, env }
    } else {
      // pushing at front so later specification tromps it
      const push = (project: string, ...args: string[]) => {
        pkgs.unshift({ project, constraint: new semver.Range("*") })
        args.push(...args)
      }
      const args: string[] = []

      switch (script.extname()) {
      case ".py":
        push("python.org", "python")
        break
      case ".js":
        push("nodejs.org", "node")
        break
      case ".ts":
        push("deno.land", "deno", "run")
        break
      case ".go":
        push("go.dev", "go", "run")
        break
      case ".pl":
        push("perl.org", "perl")
        break
      }

      args.push(...mkargs(input))

      return { mode, args, pkgs, env }
    }
  } else if (!arg0) {
    // in fact, no arguments were specified at all

    if (mode[1] == "env" && !await maybe_env()) {
      throw "no environment found"  //TODO show usage, usage in general should show env info
      // ^^ if no env can be found for modes we need an env
    }

    // k, we’re inferring executable markdown
    return {
      mode,
      pkgs,
      args: flatmap(env?.requirementsFile, x=>[x.string]) ?? [],
      env
    }
  } else if (await maybe_env()) {

    try {
      // k there's an env, let’s see if there's a target
      if (await useExecutableMarkdown({ filename: env!.requirementsFile }).findScript(arg0)) {
        return {
          mode,
          pkgs,
          args: [env!.requirementsFile.string, ...mkargs(input)],
          env
        }
      }
    } catch {
      //TODO only catch for no executable markdown target
    }

    // if no target fall back to default pass-through behavior
  }

  // we’re out of ideas, let the SHELL sort it out
  await maybe_env()

  return {
    mode,
    pkgs,
    args: mkargs(input),
    env
  }

  async function maybe_env() {
    if (env) return env
    env = await useVirtualEnv().swallow(/not-found/)
    pkgs.push(...env?.requirements ?? [])
    return env
  }
}

function mkargs(input: Args): string[] {
  const args = input.args.std
  if (input.args.fwd.length) args.push("--", ...input.args.fwd)
  return args
}
