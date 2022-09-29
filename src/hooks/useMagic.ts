import { PackageRequirement } from "types"
import { flatmap } from "utils"
import useFlags, { ReturnValue, Mode } from "hooks/useFlags.ts"
import useVirtualEnv, { VirtualEnv } from "hooks/useVirtualEnv.ts"
import { useExecutableMarkdown, useCache } from "hooks"
import { usePackageYAMLFrontMatter } from "hooks/usePackageYAML.ts"
import Path from "path"
import * as semver from "semver"

type Args = Omit<ReturnValue, 'cd'>

export type ProcessedArgs = {
  mode: Mode
  args: string[]
  env: VirtualEnv | undefined
  pkgs: PackageRequirement[]  // env.pkgs + explicit on CLI + YAML front matter etc.
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
      getArguments(input),
      env?.requirements ?? []
    ]

    const yaml = await usePackageYAMLFrontMatter(script, env?.srcroot).swallow("no-front-matter")

    return [
      [...yaml?.getArgs() ?? [], ...getArguments(input)],
      [...yaml?.getDeps(false) ?? [], ...env?.requirements ?? [], ]
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

  if (script) {
    //NOTE if you specify a script it won’t add the env automatically—even if there’s one present

    const yaml = await usePackageYAMLFrontMatter(script, env?.srcroot).swallow("no-front-matter")

    if (yaml) {
      const pkgs = [...yaml.getDeps(false), ...env?.requirements ?? []]
      const args = [...yaml.getArgs(), ...getArguments(input)]
      return { mode, args, pkgs, env }
    } else {
      const pkgs = env?.requirements ?? []

      // pushing at front so later specification tromps it
      const push = (project: string) => pkgs.unshift({ project, constraint: new semver.Range("*") })
      const args: string[] = []

      switch (script.extname()) {
      case ".py":
        args.push("python")
        push("python.org")
        break
      case ".ts":
      case ".js":
        args.push("deno", "run")
        push("deno.land")
        break
      }

      args.push(...getArguments(input))

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
      pkgs: env?.requirements ?? [],
      args: flatmap(env?.requirementsFile, x=>[x.string]) ?? [],
      env
    }
  } else if (await maybe_env()) {

    try {
      // k there's an env, let’s see if there's a target
      if (await useExecutableMarkdown({ filename: env!.requirementsFile }).findScript(arg0)) {
        return {
          mode,
          pkgs: env!.requirements,
          args: [env!.requirementsFile.string, ...getArguments(input)],
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
    pkgs: env?.requirements ?? [],
    args: getArguments(input),
    env
  }

  async function maybe_env() {
    return env ?? (env = await useVirtualEnv().swallow(/not-found/))
  }
}

function getArguments(input: Args): string[] {
  const args = input.args.std
  if (input.args.fwd.length) args.push("--", ...input.args.fwd)
  return args
}
