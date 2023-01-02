import { useShellEnv, useExecutableMarkdown, useVirtualEnv, useDownload, usePackageYAMLFrontMatter, useRequirementsFile, usePantry } from "hooks"
import { run, undent, pkg as pkgutils, UsageError, panic, TeaError, RunError, async_flatmap } from "utils"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { Installation, PackageSpecification } from "types"
import { VirtualEnv } from "./hooks/useVirtualEnv.ts"
import useFlags, { Args } from "hooks/useFlags.ts"
import { flatten } from "hooks/useShellEnv.ts"
import { gray, Logger, red } from "hooks/useLogger.ts"
import * as semver from "semver"
import Path from "path"
import { Interpreter } from "hooks/usePantry.ts";

//TODO specifying explicit pkgs or versions on the command line should replace anything deeper
//    RATIONALE: so you can override if you are testing locally


export default async function(opts: Args) {
  const { verbosity, ...flags } = useFlags()
  const assessment = assess(opts.args)

  if (assessment.type == 'repl') {
    if (!opts.pkgs.length && flags.sync) Deno.exit(0)    // `tea -S` is not an error or a repl
    if (!opts.pkgs.length && verbosity > 0) Deno.exit(0) // `tea -v` is not an error or a repl
    if (!opts.pkgs.length) throw new UsageError()

    const { installed, env } = await install(opts.pkgs)
    await repl(installed, env)

  } else try {
    const refinement = await refine(assessment)
    await exec(refinement, opts.pkgs, {env: opts.env ?? false})
  } catch (err) {
    handler(err)
  }
}

// deno-lint-ignore no-explicit-any
export function handler(err: any) {
  const { debug } = useFlags()

  if (err instanceof TeaError) {
    throw err
  } else if (debug) {
    console.error(err)
  } else if (err instanceof Deno.errors.NotFound) {
    // deno-lint-ignore no-explicit-any
    console.error("tea: command not found:", (err as any).cmd)
    //NOTE ^^ we add cmd into the error ourselves in utils/ru
  } else if (err instanceof RunError == false) {
    const decapitalize = ([first, ...rest]: string) => first.toLowerCase() + rest.join("")
    console.error(`${red("error")}:`, decapitalize(err.message))
  }
  const code = err?.code ?? 1
  Deno.exit(isNumber(code) ? code : 1)
}

async function refine(ass: RV2): Promise<RV1> {
  const { magic } = useFlags()

  switch (ass.type) {
  case 'url': {
    const path = await useDownload().download({ src: ass.url })
    ass = assess_file(path.chmod(0o700), ass.args)
  } break

  case 'dir':
    //FIXME `README.md` is not the only spelling we accept
    ass = { type: 'md', path: ass.path.join("README.md"), args: ass.args }
    break

  case 'cmd': {
    if (!magic) break  // without magic you cannot specify exe/md targets without a path parameter
    const blueprint = await useVirtualEnv().swallow(/^not-found/)
    if (!blueprint) break // without a blueprint just passthru
    const filename = blueprint.file
    const sh = await useExecutableMarkdown({ filename }).findScript(ass.args[0]).swallow(/^not-found/)
    if (!sh) break // no exe/md target called this so just passthru
    ass = { type: 'md', path: filename, sh, blueprint, name: ass.args[0], args: ass.args.slice(1) }
  }}

  return ass
}

async function exec(ass: RV1, pkgs: PackageSpecification[], opts: {env: boolean}) {
  const { debug, magic } = useFlags()

  switch (ass.type) {
  case 'md': {
    //TODO we should probably infer magic as meaning: find the v-env and add it

    const blueprint = opts.env
      ? ass.blueprint ?? await useVirtualEnv()
      : magic
        ? ass.blueprint ?? await useVirtualEnv({ cwd: ass.path.parent() }).swallow(/not-found/)
        : undefined
    // ^^ jeez we’ve overcomplicated this shit

    const name = ass.name ?? 'getting-started'
    const sh = ass.sh ?? await useExecutableMarkdown({ filename: ass.path }).findScript(name)
    const { pkgs } = await useRequirementsFile(ass.path) ?? panic()
    const { env } = await install(pkgs)
    const basename = ass.path.string.replaceAll("/", "_") //FIXME this is not sufficient escaping

    if (blueprint) {
      if (blueprint.version) env['VERSION'] = blueprint.version.toString()
      env['SRCROOT'] = blueprint.srcroot.string
      pkgs.push(...blueprint.pkgs)
    }

    const arg0 = Path.mktmp().join(`${basename}.bash`).write({ force: true, text: undent`
      #!/bin/bash
      set -e
      ${debug ? "set -x" : ""}
      ${sh} ${is_oneliner(sh) ? '"$@"' : ''}
      ` }).chmod(0o500)
    //FIXME ^^ putting "$@" at the end can be invalid, it really depends on the script TBH
    //FIXME ^^ shouldn’t necessarily default to bash (or we should at least install it (duh))

    const cmd = [arg0, ...ass.args]

    await run({cmd, env})

  } break

  case 'sh': {
    const blueprint = opts.env ? await useVirtualEnv({ cwd: ass.path.parent() }) : undefined
    const yaml = await usePackageYAMLFrontMatter(ass.path, blueprint?.srcroot)
    const cmd = [...yaml?.args ?? [], ass.path, ...ass.args]

    if (blueprint) pkgs.push(...blueprint.pkgs)
    if (yaml) pkgs.push(...yaml.pkgs)

    if (magic) {
      const found = await async_flatmap(extract_shebang(ass.path), which)

      if (found) {
        pkgs.unshift(found)

        //TODO how do we make these tools behave exactly as they would
        // during “shebang” executed mode? Because then we don’t need
        // any special casing, we just run the shebang

        if (!isArray(yaml?.args)) switch (found.project) {
          case "deno.land":
            cmd.unshift("deno", "run"); break
          case "gnu.org/bash":
            cmd.unshift("bash", "-e"); break
          case "go.dev":
            throw new TeaError('#helpwanted', { details: undent`
              go does not support shebangs, but there is a package called gorun
              that we could use to do this, please package for us 🙏
              `})
          default:
            cmd.unshift(found.shebang)
        }

      } else {
        const unshift = ({ project, args: new_args }: Interpreter) => {
          if (!yaml?.pkgs.length) {
            pkgs.unshift({ project, constraint: new semver.Range("*") })
          }
          if (!yaml?.args.length) {
            cmd.unshift(...new_args)
          }
        }

        const interpreter = await usePantry().getInterpreter(ass.path.extname())
        if (interpreter) unshift(interpreter)
      }
    }

    const { env } = await install(pkgs)

    supp(env, blueprint)
    if (yaml?.env) Object.assign(env, yaml.env)  // explicit YAML-FM env takes precedence

    await run({ cmd, env })

  } break

  case 'cmd': {
    const { env } = await prepare_exec_cmd(pkgs, opts)
    await run({ cmd: ass.args, env })
  }}
}

////

export async function prepare_exec_cmd(pkgs: PackageSpecification[], opts: {env: boolean}) {
  const { magic } = useFlags()
  let blueprint: VirtualEnv | undefined
  if (opts.env) {
    blueprint = await useVirtualEnv()
    pkgs.push(...blueprint.pkgs)
  } else if (magic && (blueprint = await useVirtualEnv().swallow(/^not-found/))) {
    pkgs.push(...blueprint.pkgs)
  }
  const { env } = await install(pkgs)
  supp(env, blueprint)
  return { env, pkgs }
}

import {readLines} from "deno/io/buffer.ts"

async function extract_shebang(path: Path) {
  const f = await Deno.open(path.string, { read: true })
  const line = (await readLines(f).next()).value
  let shebang = line.match(/^\s*#!(\S+)$/)?.[1]
  if (shebang) {
    return Path.abs(shebang)?.basename()
  }
  shebang = line.match(/^\s*#!\/usr\/bin\/env (\S+)$/)?.[1]
  if (shebang) {
    return shebang[1] ?? panic()
  }
}

const subst = function(start: number, end: number, input: string, what: string) {
  return input.substring(0, start) + what + input.substring(end)
};

export async function which(arg0: string) {
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
          const constraint = new semver.Range("*")
          found = {...entry, constraint, shebang: provider }
        } else if (arg0.startsWith(provider)) {
          // eg. `node^16` symlink
          try {
            const constraint = new semver.Range(arg0.substring(provider.length))
            if (constraint) {
              found = {...entry, constraint, shebang: provider }
              return
            }
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

function is_oneliner(sh: string) {
  const lines = sh.split("\n")
  for (const line of lines.slice(0, -1)) {
    if (!line.trim().endsWith("\\")) return false
  }
  return true
}

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

function supp(env: Record<string, string>, blueprint?: VirtualEnv) {
  if (blueprint) {
    if (blueprint.version) env['VERSION'] = blueprint.version?.toString()
    env['SRCROOT'] = blueprint.srcroot.string
  }
}

import { basename } from "deno/path/mod.ts"
import { isArray, isNumber } from "is_what"

async function repl(installations: Installation[], env: Record<string, string>) {
  const pkgs_str = () => installations.map(({pkg}) => gray(pkgutils.str(pkg))).join(", ")
  console.info('this is a temporary shell containing the following packages:')
  console.info(pkgs_str())
  console.info("when done type: `exit'")
  const shell = Deno.env.get("SHELL")?.trim() || "/bin/sh"
  const cmd = [shell, '-i'] // interactive

  //TODO other shells pls #help-wanted

  switch (basename(shell)) {
  case 'bash':
    cmd.splice(1, 0, '--norc', '--noprofile') // longopts must precede shortopts
    // fall through
  case 'sh':
    env['PS1'] = "\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] %~ "
    break
  case 'zsh':
    env['PS1'] = "%F{086}tea%F{reset} %~ "
    cmd.push('--no-rcs', '--no-globalrcs')
    break
  case 'fish':
    cmd.push(
      '--no-config',
      '--init-command',
      'function fish_prompt; set_color 5fffd7; echo -n "tea"; set_color grey; echo " %~ "; end'
      )
  }

  try {
    await run({ cmd, env })
  } catch (err) {
    if (err instanceof RunError) {
      Deno.exit(err.code)
    } else {
      throw err
    }
  }
}

type RV0 = { type: 'sh', path: Path, args: string[] } |
           { type: 'md', path: Path, name?: string, sh?: string, blueprint?: VirtualEnv, args: string[] }
type RV1 = RV0 |
           { type: "cmd", args: string[] }
type RV2 = RV1 |
           { type: "url", url: URL, args: string[] } |
           { type: "dir", path: Path, args: string[] }
type RV3 = RV2 |
           { type: 'repl' }

function assess_file(path: Path, args: string[]): RV0 {
  return isMarkdown(path)
    ? { type: 'md', path, name: args[0], args: args.slice(1) }
    : { type: 'sh', path, args }
}

function assess([arg0, ...args]: string[]): RV3 {
  if (!arg0?.trim()) {
    return { type: 'repl' }
  }
  const url = urlify(arg0)
  if (url) {
    return { type: 'url', url, args }
  } else {
    const path = Path.cwd().join(arg0)
    if (path.isDirectory()) return { type: 'dir', path, args }
    if (path.isFile()) return assess_file(path, args)
    return { type: 'cmd', args: [arg0, ...args] }
  }
}

async function install(pkgs: PackageSpecification[]): Promise<{ env: Record<string, string>, installed: Installation[] }> {
  const flags = useFlags()

  const logger = new Logger()
  logger.replace("resolving package graph")

  if (flags.magic) {
    pkgs = [...pkgs]
    const pantry = usePantry()
    for (const pkg of pkgs) {
      pkgs.push(...await pantry.getCompanions(pkg))
    }
  }

  console.debug({hydrating: pkgs})

  const { pkgs: wet } = await hydrate(pkgs)
  const {installed, pending} = await resolve(wet, { update: flags.sync })
  logger.clear()

  for (const pkg of pending) {

    const install = await base_install(pkg)
    await link(install)
    installed.push(install)
  }
  const env = await useShellEnv({ installations: installed })
  return { env: flatten(env), installed }
}
