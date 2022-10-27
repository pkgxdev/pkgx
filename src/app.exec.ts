import { useShellEnv, useExecutableMarkdown, useVirtualEnv, useDownload, usePackageYAMLFrontMatter } from "hooks"
import useFlags, { Args } from "hooks/useFlags.ts"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { PackageRequirement, PackageSpecification } from "types"
import { run, undent, pkg as pkgutils } from "utils"
import * as semver from "semver"
import Path from "path"
import { isNumber } from "is_what"
import { VirtualEnv } from "./hooks/useVirtualEnv.ts";
import { Logger } from "./hooks/useLogger.ts"

//TODO avoid use of virtual-env if not required

export default async function exec(opts: Args) {
  const { verbose, ...flags } = useFlags()
  const {args: cmd, pkgs: sparkles, blueprint} = await abracadabra(opts)

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

  try {
    if (cmd.length) {
      /// no command is strictly acceptable, it’s an idiomatic use of `exec` mode
      /// it just means: noop
      await run({ cmd, env })  //TODO implement `execvp` for deno
    }
  } catch (err) {
    if (verbose) {
      console.error(err)
    } else if (err instanceof Deno.errors.NotFound) {
      console.error("tea: command not found:", cmd[0])
    }
    const code = err?.code ?? 1
    Deno.exit(isNumber(code) ? code : 1)
  }
}

/////////////////////////////////////////////////////////////
async function install(dry: PackageSpecification[]) {
  const wet = await hydrate(dry)      ; console.debug({wet})
  const gas = await resolve(wet.pkgs) ; console.debug({gas})

  for (const pkg of gas.pending) {
    const rq = wet.pkgs.find(rq => rq.project == pkg.project)
    const logger = new Logger(pkgutils.str(rq ?? pkg))
    const installation = await base_install(pkg, logger)
    await link(installation)
    gas.installed.push(installation)
  }
  return gas.installed
}


interface RV {
  args: string[]
  pkgs: PackageRequirement[]
  blueprint?: VirtualEnv
}

//TODO we know what packages `provides`, so we should be able to auto-install
// eg rustc if you just do `tea rustc`
async function abracadabra(opts: Args): Promise<RV> {
  const { magic } = useFlags()
  const pkgs: PackageRequirement[] = []
  const args = [...opts.args]

  let env = magic ? await useVirtualEnv().swallow("not-found:srcroot") : undefined

  if (env && args.length) {
    // firstly check if there is a target named args[0]
    // since we don’t want to allow the security exploit where you can make a file
    // and steal execution when a target was intended
    // NOTE user can still specify eg. `tea ./foo` if they really want the file

    const scriptName = args[0] == '.' ? 'getting-started' : args[0]

    const sh = await useExecutableMarkdown({ filename: env.requirementsFile }).findScript(scriptName).swallow(/exe\/md/)
    if (sh) {
      return mksh(sh)
    } else if (args.length == 0) {
      throw new Error(`no default target found in: ${env.requirementsFile}`)
    }
  }

  const path = await (async () => {
    if (args.length == 0) return
    try {
      const src = new URL(args[0])
      const path = await useDownload().download({ src })
      args[0] = path.string
      return path
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
    if (opts.env) {
      // for scripts, we ignore the working directory as virtual-env finder
      // and work from the script, note that the user had to `#!/usr/bin/env -S tea -E`
      // for that to happen so in the shebang we are having that explicitly set
      env = await useVirtualEnv({ cwd: path.parent() })

      //NOTE this maybe is wrong? maybe we should read the script and check if we were shebanged
      // with -E since `$ tea -E path/to/script` should perhaps use the active env?
    } else {
      //NOTE this REALLY may be wrong
      env = undefined
    }

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

  return {args, pkgs, blueprint: env}

  function isMarkdown(path: Path) {
    //ref: https://superuser.com/a/285878
    switch (path.extname()) {
    case ".md":
    case '.mkd':
    case '.mdwn':
    case '.mdown':
    case '.mdtxt':
    case '.mdtext':
    case '.markdown':
    case '.text':
    case '.md.txt':
      return true
    }
  }

  function mksh(sh: string) {
    //TODO no need to make the file, just pipe to stdin
    //TODO should be able to specify script types
    const [arg0, ...argv] = args

    //FIXME won’t work as expected for various scenarios
    // but not sure how else to represent this without adding an explcit requirement for "$@" in the script
    // or without parsing the script to determine where to insert "$@"
    // simple example of something difficult would be a for loop since it ends with `done` so we can't just stick the "$@" at the end of the last line
    const oneliner = (() => {
      const lines = sh.split("\n")
      for (const line of lines.slice(0, -1)) {
        if (!line.trim().endsWith("\\")) return false
      }
      return true
    })()

    //FIXME putting "$@" at the end can be invalid, it really depends on the script TBH

    const path = Path.mktmp().join(arg0).write({ text: undent`
      #!/bin/bash
      set -e
      ${sh} ${oneliner ? '"$@"' : ''}
    ` }).chmod(0o500)

    return {
      args: [path.string, ...argv],
      pkgs,
      blueprint: env
    }
  }
}
