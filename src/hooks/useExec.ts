import { usePantry, useShellEnv, useDownload, usePackageYAMLFrontMatter, usePrefix, useDarkMagic, useRun } from "hooks"
import { PackageSpecification, Installation, PackageRequirement } from "types"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { VirtualEnv } from "./useVirtualEnv.ts"
import { flatten } from "./useShellEnv.ts"
import useLogger from "./useLogger.ts"
import { pkg as pkgutils, TeaError } from "utils"
import * as semver from "semver"
import Path from "path"
import PathUtils from "path-utils"
import { isArray } from "is_what"

interface Parameters {
  args: string[]
  pkgs: PackageSpecification[]
  inject?: VirtualEnv
  sync: boolean
  chaste: boolean
}

export default async function({ pkgs, inject, sync, ...opts }: Parameters) {
  const cmd = [...opts.args]
  const arg0 = await fetch_it(cmd[0])
  if (arg0) cmd[0] = arg0?.toString()  // if we downloaded it then we need to replace args[0]
  const clutch = pkgs.length > 0
  const env: Record<string, string> = inject?.env ?? {}

  if (inject) {
    const {version, srcroot, teafiles, ...vrtenv} = inject
    if (version) env["VERSION"] = version.toString()
    env["SRCROOT"] = srcroot.toString()
    env["TEA_FILES"] = teafiles.join(":")
    pkgs.push(...vrtenv.pkgs)
  }

  if (arg0 instanceof Path && arg0.isFile()) {

    const precmd: string[] = []

    const yaml = await usePackageYAMLFrontMatter(arg0, inject?.srcroot)
    if (yaml) {
      precmd.unshift(...yaml.args)
      Object.assign(env, yaml.env)  //FIXME should override env from pkgs
      pkgs.push(...yaml.pkgs)
    }

    const shebang_args = await read_shebang(arg0)
    const is_tea_shebang = shebang_args[0] == 'tea'
    if (shebang_args.length) {
      if (is_tea_shebang) {
        do {
          shebang_args.shift()
        } while (shebang_args[0]?.startsWith('-'))
      }
      precmd.unshift(...shebang_args)
    }

    if (precmd.length == 0) {
      const found = await usePantry().getInterpreter(arg0.extname())
      if (found) {
        pkgs.push({ ...found, constraint: new semver.Range('*') })
        precmd.unshift(...found.args)
        await add_companions(found)
      } else if (is_tea_shebang) {
        if (arg0.extname() == '.sh') {
          precmd.unshift("sh")
        } else {
          throw new TeaError("confused: interpreter", {arg0})
        }
      }
    } else {
      const found = await which(precmd[0])
      if (found) {
        pkgs.push(found)
        await add_companions(found)
      }
    }

    cmd.unshift(...precmd)

  } else if (!clutch && !(arg0 instanceof Path)) {
    const found = await which(arg0)
    if (found) {
      pkgs.push(found)
      if (isArray(found.shebang)) {
        cmd.unshift(...found.shebang as string[])
      } else {
        cmd[0] = found.shebang as string
      }
      await add_companions(found)
      if (found.precmd) {
        // FIXME: this is a weird one. It could take _minutes_ to install something
        // (though ctrl-c works, as long as you're not in docker). That's a little
        // less magical, but for installs they should only run one time. Installs
        // will also end up outside tea's prefix, so they won't be removed by
        // uninstall. So maybe this is fine?

        // also FIXME: once you _execute_ cargo install, `--provides` returns false,
        // since it's in the path at that point. But I doubt uninstalling after
        // run is the right answer.
        await useRun({ cmd: found.precmd })
      }
    }
  }

  let installations: Installation[]
  if (!opts.chaste) {
    const { installed, dry } = await install(pkgs, sync)
    installations = installed
    pkgs = dry  // reassign as condensed + sorted
  } else {
    const cellar = useCellar()
    const { pkgs: wet, dry } = await hydrate(pkgs)
    installations = (await Promise.all(wet.map(cellar.has))).compact()
    pkgs = dry  // reassign as condensed + sorted
  }

  Object.assign(env, flatten(await useShellEnv({ installations })))

  env["TEA_PREFIX"] ??= usePrefix().string

  return { env, cmd, installations, pkgs }

  async function add_companions(pkg: {project: string}) {
    pkgs.push(...await usePantry().getCompanions(pkg))
  }
}


///////////////////////////////////////////////////////////////////////////// funcs

async function install(pkgs: PackageSpecification[], update: boolean) {
  const logger = useLogger()
  logger.replace("resolving package graph")

  console.debug({hydrating: pkgs})

  const { pkgs: wet, dry } = await hydrate(pkgs)
  const {installed, pending} = await resolve(wet, { update })
  logger.clear()

  for (const pkg of pending) {
    const install = await base_install(pkg)
    await link(install)
    installed.push(install)
  }

  return { installed, dry }
}

import { readLines } from "deno/io/read_lines.ts"

async function read_shebang(path: Path): Promise<string[]> {
  const f = await Deno.open(path.string, { read: true })
  const line = (await readLines(f).next()).value as string
  let shebang = line.match(/^#!\/usr\/bin\/env (-\S+ )?(.*)$/)?.[2]
  if (shebang) {
    return shebang.split(/\s+/).filter(x => x)
  }

  // allowing leading whitespace since it seems pretty common in the wild
  shebang = line.match(/^\s*#!(.*)$/)?.[1]
  if (shebang) {
    const args = shebang.split(/\s+/).filter(x => x)
    const arg0 = Path.abs(args.shift() ?? '')?.basename()
    if (!arg0) throw new Error(`couldn’t figure out shebang: ${line} for ${path}`)
    return [arg0, ...args]
  }

  return []
}

import useCellar from "./useCellar.ts"
import useConfig, { useEnv } from "./useConfig.ts"

async function fetch_it(arg0: string | undefined) {
  if (!arg0) return

  const url = urlify(arg0)
  if (url) {
    const path = await useDownload().download({ src: url })
    return path.chmod(0o700)  //FIXME like… I don’t feel we should necessarily do this…
  }

  const { execPath } = useConfig()
  const path = Path.cwd().join(arg0)
  if (path.exists() && execPath.basename() == "tea") {
    // ^^ in the situation where we are shadowing other tool names
    // we don’t want to fork bomb if the tool in question is in CWD

    if (path.extname() == '' && !arg0.includes("/")) {
      // for this case we require ./
      // see: https://github.com/teaxyz/cli/issues/335#issuecomment-1402293358
      return arg0
    }

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
  shebang?: string | string[]
  precmd?: string[]
}

export async function which(arg0: string | undefined) {
  if (!arg0?.chuzzle() || arg0.includes("/")) {
    // no shell we know allows searching for subdirectories off PATH
    return false
  }

  const { TEA_PKGS } = useEnv()
  const pantry = usePantry()
  let found: { project: string, constraint: semver.Range, shebang: string, precmd: string[] | undefined } | undefined
  const promises: Promise<void>[] = []

  for await (const entry of pantry.ls()) {
    if (found) break
    const p = pantry.getProvides(entry).then(providers => {
      for (const provider of providers) {
        if (found) {
          return
        } else if (provider == arg0) {
          const inenv = TEA_PKGS?.split(":")
            .map(pkgutils.parse)
            .find(x => x.project == entry.project)
          if (inenv) {
            // we are being executed via the command not found handler inside a dev-env
            // so let’s use the version that was already calculated for this dev-env
            if ("version" in inenv) {
              found = {...inenv, constraint: new semver.Range(`=${inenv.version}`), shebang: provider, precmd: undefined }
            } else {
              found = {...inenv, shebang: provider, precmd: undefined }
            }
          } else {
            const constraint = new semver.Range("*")
            found = {...entry, constraint, shebang: provider, precmd: undefined }
          }
        } else if (arg0.startsWith(provider)) {
          // eg. `node^16` symlink
          try {
            const constraint = new semver.Range(arg0.substring(provider.length))
            found = {...entry, constraint, shebang: provider, precmd: undefined }
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
            found = {...entry, constraint, shebang: arg0, precmd: undefined }
          }
        }
      }
    }).swallow(/^parser: pantry: package.yml/)
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

  // dark-magic will find a _lot_ of things, even when we might not want to.
  // https://www.npmjs.com/package/sh is a great example, and probably not what
  // we're looking for if we say `tea sh` (which is a common thing to do).
  // So, we should only pass through if the tool we want isn't on the path.
  const { env } = useConfig()
  if (PathUtils.findBinary(arg0, env.PATH)) return false

  // Here is where we check our dark magic providers for the name in question.
  return useDarkMagic().which(arg0)
}

const subst = function(start: number, end: number, input: string, what: string) {
  return input.substring(0, start) + what + input.substring(end)
}
