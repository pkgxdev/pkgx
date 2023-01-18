import { usePantry, useShellEnv, useDownload, usePackageYAMLFrontMatter } from "hooks"
import { PackageSpecification, Installation, PackageRequirement } from "types"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { VirtualEnv } from "./useVirtualEnv.ts"
import { flatten } from "./useShellEnv.ts"
import { Logger } from "./useLogger.ts"
import { panic, pkg as pkgutils } from "utils"
import * as semver from "semver"
import Path from "path"

interface Parameters {
  args: string[]
  pkgs: PackageSpecification[]
  inject?: VirtualEnv
  sync: boolean
}

export default async function({ pkgs, inject, sync, ...opts }: Parameters) {
  const cmd = [...opts.args]
  const arg0 = await fetch_it(cmd[0])
  if (arg0) cmd[0] = arg0?.toString()  // if we downloaded it then we need to replace args[0]
  const clutch = pkgs.length > 0
  const env: Record<string, string> = {}
  let post_install = (_installs: Installation[]) => {}

  if (inject) {
    const {version, srcroot, file, ...vrtenv} = inject
    if (version) env["VERSION"] = version.toString()
    env["SRCROOT"] = srcroot.toString()
    env["TEA_FILE"] = file.toString()
    pkgs.push(...vrtenv.pkgs)
  }

  if (arg0 instanceof Path && arg0.isFile()) {
    //TODO should check we're a text file first
    const yaml = await usePackageYAMLFrontMatter(arg0, inject?.srcroot)
    if (yaml) {
      pkgs.push(...yaml.pkgs)
      Object.assign(env, yaml.env)  //FIXME should override env from pkgs
      cmd.unshift(...yaml.args)
    }
    const shebang = await read_shebang(arg0)
    if (shebang) {
      const found = await which(shebang)
      if (found) {
        pkgs.push(found)
        // we don’t alter `cmd` since the shebang literally specifies how to run this script
      }
    } else {
      const found = await usePantry().getInterpreter(arg0.extname())
      if (found) {
        const constraint = new semver.Range('*')
        pkgs.push({ ...found, constraint })
        if (cmd.length == opts.args.length) {
          // if YAML specified args then we use them
          cmd.unshift(...found.args)
        }
      }
    }
  } else if (!clutch && !(arg0 instanceof Path)) {
    const found = await which(arg0)
    if (found) {
      pkgs.push(found)
      post_install = (installs: Installation[]) => {
        // attempt to become full path to avoid a potential fork bomb scenario
        // though if that happened it would be a bug in us ofc.
        const install = installs.find(x => x.pkg.project == found.project) ?? panic()
        cmd[0] = ["bin", "sbin"].compact(x =>
          install.path.join(x, found.shebang).isExecutableFile()
        )[0]?.string ?? found.shebang
      }
    }
  }

  const installations = await install(pkgs, sync)

  post_install(installations)

  Object.assign(env, flatten(await useShellEnv({ installations })))

  return { env, cmd, pkgs: installations }
}


///////////////////////////////////////////////////////////////////////////// funcs

async function install(pkgs: PackageSpecification[], update: boolean): Promise<Installation[]> {
  const logger = new Logger()
  logger.replace("resolving package graph")

  console.debug({hydrating: pkgs})

  const { pkgs: wet } = await hydrate(pkgs)
  const {installed, pending} = await resolve(wet, { update })
  logger.clear()

  for (const pkg of pending) {
    const install = await base_install(pkg)
    await link(install)
    installed.push(install)
  }

  return installed
}

import { readLines } from "deno/io/read_lines.ts"

async function read_shebang(path: Path) {
  const f = await Deno.open(path.string, { read: true })
  const line = (await readLines(f).next()).value as string
  let shebang = line.match(/^\s*#!(\S+)(\s*)$/)?.[1]
  if (shebang) {
    return Path.abs(shebang)?.basename()
  }
  shebang = line.match(/^\s*#!\/usr\/bin\/env (\S+)$/)?.[1]
  if (shebang && shebang != 'tea') {
    return shebang[1]
  }
}

async function fetch_it(arg0: string | undefined) {
  if (!arg0) return
  const url = urlify(arg0)
  if (url) {
    const path = await useDownload().download({ src: url })
    return path.chmod(0o700)  //FIXME like… I don’t feel we should necessarily do this…
  }
  const path = Path.cwd().join(arg0)
  if (path.exists()) {
    return path
  } else {
    return arg0
  }
}

function urlify(arg0: string) {
  try {
    const url = new URL(arg0)
    // we do some magic so GitHub URLs are immediately usable
    switch (url.host) {
    case "github.com":
      url.host = "raw.githubusercontent.com"
      url.pathname = url.pathname.replace("/blob/", "/")
      break
    case "gist.github.com":
      url.host = "gist.githubusercontent.com"
      //FIXME this is not good enough
      // for multifile gists this just gives us a bad URL
      //REF: https://gist.github.com/atenni/5604615
      url.pathname += "/raw"
      break
    }
    return url
  } catch {
    //noop
  }
}

type WhichResult = PackageRequirement & {
  shebang?: string
}

async function which(arg0: string | undefined) {
  if (!arg0?.chuzzle() || arg0.includes("/")) {
    // no shell we know allows searching for subdirectories off PATH
    return false
  }

  const pantry = usePantry()
  let found: { project: string, constraint: semver.Range, shebang: string } | undefined
  const promises: Promise<void>[] = []

  for await (const entry of pantry.ls()) {
    if (found) break
    const p = pantry.getProvides(entry).then(providers => {
      for (const provider of providers) {
        if (found) {
          return
        } else if (provider == arg0) {
          const inenv = Deno.env.get("TEA_PKGS")
            ?.split(":")
            .map(pkgutils.parse)
            .find(x => x.project == entry.project)
          if (inenv) {
            // we are being executed via the command not found handler inside a dev-env
            // so let’s use the version that was already calculated for this dev-env
            if ("version" in inenv) {
              found = {...inenv, constraint: new semver.Range(`=${inenv.version}`), shebang: provider }
            } else {
              found = {...inenv, shebang: provider }
            }
          } else {
            const constraint = new semver.Range("*")
            found = {...entry, constraint, shebang: provider }
          }
        } else if (arg0.startsWith(provider)) {
          // eg. `node^16` symlink
          try {
            const constraint = new semver.Range(arg0.substring(provider.length))
            found = {...entry, constraint, shebang: provider }
          } catch {
            // not a valid semver range; fallthrough
          }
        } else {
          //TODO more efficient to check the prefix fits arg0 first
          // eg. if python3 then check if the provides starts with python before
          // doing all the regex shit. Matters because there's a *lot* of YAMLs

          let rx = /({{\s*version\.(marketing|major)\s*}})/
          let match = provider.match(rx)
          if (!match?.index) continue
          const regx = match[2] == 'major' ? '\\d+' : '\\d+\\.\\d+'
          const foo = subst(match.index, match.index + match[1].length, provider, `(${regx})`)
          rx = new RegExp(`^${foo}$`)
          match = arg0.match(rx)
          if (match) {
            const constraint = new semver.Range(`~${match[1]}`)
            found = {...entry, constraint, shebang: arg0 }
          }
        }
      }
    })
    promises.push(p)
  }

  if (!found) {
    // if we didn’t find anything yet then we have to wait on the promises
    // otherwise we can ignore them
    await Promise.all(promises)
  }

  if (found) {
    return found
  }
}

const subst = function(start: number, end: number, input: string, what: string) {
  return input.substring(0, start) + what + input.substring(end)
}
