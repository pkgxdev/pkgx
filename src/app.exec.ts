import { useShellEnv, useExecutableMarkdown, useVirtualEnv, useDownload, usePackageYAMLFrontMatter, useRequirementsFile, usePantry } from "hooks"
import { run, undent, pkg as pkgutils, UsageError, panic, TeaError, RunError } from "utils"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { Installation, PackageRequirement, PackageSpecification } from "types"
import { VirtualEnv } from "./hooks/useVirtualEnv.ts"
import useFlags, { Args } from "hooks/useFlags.ts"
import { flatten } from "hooks/useShellEnv.ts"
import { gray, Logger, red } from "hooks/useLogger.ts"
import * as semver from "semver"
import Path from "path"

//TODO specifying explicit pkgs or versions on the command line should replace anything deeper
//    RATIONALE: so you can override if you are testing locally


export default async function(opts: Args) {
  const { debug, verbosity, ...flags } = useFlags()
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

}

async function refine(ass: RV2): Promise<RV1> {
  const { magic } = useFlags()

  switch (ass.type) {
  case 'url': {
    const path = await useDownload().download({ src: ass.url })
    ass = assess_file(path, ass.args)
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

    const blueprint = opts.env ? ass.blueprint ?? await useVirtualEnv() : magic ? ass.blueprint ?? await useVirtualEnv({ cwd: ass.path.parent() }).swallow(/not-found/) : undefined
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
    const pkgs: PackageRequirement[] = [...blueprint?.pkgs ?? [], ...yaml?.pkgs ?? []]

    if (magic) {
      const unshift = (project: string, ...new_args: string[]) => {
        if (!yaml?.pkgs.length) {
          pkgs.unshift({ project, constraint: new semver.Range("*") })
        }
        if (!yaml?.args.length) {
          cmd.unshift(...new_args)
        }
      }
      //FIXME package.ymls should define these behaviors
      switch (ass.path.extname()) {
        case ".py": unshift("python.org", "python"); break
        case ".js": unshift("nodejs.org", "node"); break
        case ".ts": unshift("deno.land", "deno", "run"); break
        case ".go": unshift("go.dev", "go", "run"); break
        case ".pl": unshift("perl.org", "perl"); break
        case ".rb": unshift("ruby-lang.org", "ruby"); break
      }
    }

    const { env } = await install(pkgs)

    supp(env, blueprint)
    if (yaml?.env) Object.assign(env, yaml.env)  // explicit YAML-FM env takes precedence

    await run({ cmd, env })

  } break

  case 'cmd': {
    let blueprint: VirtualEnv | undefined
    if (opts.env) {
      blueprint = await useVirtualEnv()
      pkgs.push(...blueprint.pkgs)
    } else if (magic && (blueprint = await useVirtualEnv().swallow(/^not-found/))) {
      pkgs.push(...blueprint.pkgs)
    }
    const { env } = await install(pkgs)
    supp(env, blueprint)
    await run({ cmd: ass.args, env })
  }}
}

////

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
import { isNumber } from "is_what"

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

  await run({ cmd, env })
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

  const { pkgs: wet } = await hydrate(pkgs)
  const {installed, pending} = await resolve(wet, { update: flags.sync })
  logger.clear()

  for (const pkg of pending) {

    const install = await base_install(pkg)
    await link(install)
    installed.push(install)
  }
  const env = useShellEnv({ installations: installed })
  return { env: flatten(env), installed }
}
