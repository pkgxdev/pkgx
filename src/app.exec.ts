import { useShellEnv, usePantry, useExecutableMarkdown, useVirtualEnv, useDownload, usePackageYAMLFrontMatter, usePrefix } from "hooks"
import useFlags, { Args } from "hooks/useFlags.ts"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { PackageRequirement, PackageSpecification } from "types"
import { run, undent } from "utils"
import * as semver from "semver"
import Path from "path"
import { VirtualEnv } from "./hooks/useVirtualEnv.ts";

//TODO avoid use of virtual-env if not required

export default async function exec(opts: Args) {
  const flags = useFlags()
  const blueprint = await (() => {
    if (opts.env) {
      return useVirtualEnv()
    } else if (flags.magic) {
      return useVirtualEnv().swallow("not-found:srcroot")
    }
  })()
  const {args: cmd, pkgs: sparkles} = await abracadabra(opts.args, blueprint)

  const installations = await install([...sparkles, ...opts.pkgs, ...blueprint?.requirements ?? []])

  const env = Object.entries(useShellEnv({ installations })).reduce((memo, [k, v]) => {
    memo[k] = v.join(':')
    return memo
  }, {} as Record<string, string>)

  if (blueprint) {
    env["SRCROOT"] = blueprint.srcroot.string
    if (blueprint.version) env["VERSION"] = blueprint.version.toString()
  }
  if (flags.json) {
    env["JSON"] = "1"
  }

  env["TEA_PREFIX"] = usePrefix().string

  await run({ cmd, env })  //TODO implement `execvp` for deno
}

/////////////////////////////////////////////////////////////
async function install(dry: PackageSpecification[]) {
  const get = (x: PackageSpecification) => usePantry().getDeps(x).then(x => x.runtime)
  const wet = await hydrate(dry, get)   ; console.debug({wet})
  const gas = await resolve(wet.pkgs)   ; console.debug({gas})

  for (const pkg of gas.pending) {
    console.info({ installing: pkg })
    const installation = await base_install(pkg)
    await link(installation)
    gas.installed.push(installation)
  }
  return gas.installed
}


//TODO we know what packages `provides`, so we should be able to auto-install
// eg rustc if you just do `tea rustc`
async function abracadabra(args: string[], env: VirtualEnv | undefined): Promise<{args: string[], pkgs: PackageRequirement[]}> {
  const { magic } = useFlags()
  const pkgs: PackageRequirement[] = []
  args = [...args]

  if (env) {
    // firstly check if there is a target named args[0]
    // since we don’t want to allow the security exploit where you can make a file
    // and steal execution when a target was intended
    // NOTE user can still specify eg. `tea ./foo` if they really want the file

    const sh = await useExecutableMarkdown({ filename: env.requirementsFile }).findScript(args[0]).swallow(/exe\/md/)
    if (sh) {
      return mksh(sh)
    } else if (args.length == 0) {
      throw new Error(`no default target found in: ${env.requirementsFile}`)
    }
  }

  const path = await (async () => {
    try {
      const src = new URL(args[0])
      const path =  await useDownload().download({ src })
      args[0] = path[0].string
      return path[0]
    } catch {
      return Path.cwd().join(args[0]).isFile()
    }
  })()

  if (path && isMarkdown(path)) {
    // user has explicitly requested a markdown file
    const sh = await useExecutableMarkdown({ filename: path }).findScript(args[1])
    //TODO if no `env` then we should extract deps from the markdown obv.
    return mksh(sh)

  } else if (path) {
    const yaml = await usePackageYAMLFrontMatter(path, env?.srcroot)

    if (magic) {
      // pushing at front so (any) later specification tromps it
      const unshift = (project: string, ...new_args: string[]) => {
        if (yaml?.pkgs.length == 0) {
          pkgs.unshift({ project, constraint: new semver.Range("*") })
        }
        if (yaml?.args.length == 0) {
          args.unshift(...new_args)
        }
      }

      //FIXME no hardcode! pkg.yml knows these things
      switch (path.extname()) {
      case ".py":
        unshift("python.org", "python")
        break
      case ".js":
        unshift("nodejs.org", "node")
        break
      case ".ts":
        unshift("deno.land", "deno", "run")
        break
      case ".go":
        unshift("go.dev", "go", "run")
        break
      case ".pl":
        unshift("perl.org", "perl")
        break
      case ".rb":
        unshift("ruby-lang.org", "ruby")
        break
      }
    }

    if (yaml) {
      args.unshift(...yaml.args)
      pkgs.push(...yaml.pkgs)
    }
  }

  return {args, pkgs}

  function isMarkdown(path: Path) {
    switch (path.extname()) {
    case ".md":
    case ".markdown":
      return true
    }
  }

  function mksh(sh: string) {
    //TODO no need to make the file, just pipe to stdin
    //TODO should be able to specify script types

    const path = Path.mktmp().join('script').write({ text: undent`
      #!/bin/bash
      set -e
      ${sh}
    ` }).chmod(0o500)

    return {
      args: [path.string, ...args],
      pkgs
    }
  }
}