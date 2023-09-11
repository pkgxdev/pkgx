import { hooks, Package, PackageRequirement, PackageSpecification, utils } from "tea"
import { Logger as IInstallLogger } from "./prefab/install.ts"
import internal_activate from "./modes/internal.activate.ts"
import shell_completion from "./modes/shell-completion.ts"
import parse_pkg_str from "./prefab/parse-pkg-str.ts"
import InstallLogger from "./utils/InstallLogger.ts"
import internal_use from "./modes/internal.use.ts"
import { Args as BaseArgs } from "./parse-args.ts"
import Logger, { teal } from "./utils/Logger.ts"
import integrate from "./modes/integrate.ts"
import shellcode from "./modes/shellcode.ts"
import version from "./modes/version.ts"
import install from './modes/install.ts'
import which from "./modes/which.ts"
import help from "./modes/help.ts"
import repl from "./modes/repl.ts"
import env from "./modes/env.ts"
import run from "./modes/run.ts"
import x from "./modes/x.ts"

const { usePantry, useSync } = hooks
const { flatmap } = utils

type Args = BaseArgs & { flags: { verbosity: number } }

export default async function({ flags, ...opts }: Args, logger_prefix?: string) {
  if (flags.sync) {
    await useSync()  //TODO Logger
  }

  const logger = make_logger(flags.verbosity, logger_prefix)

  switch (opts.mode) {
  case 'x': {
    const { args } = opts
    const {update, ...xopts} = await parse_xopts(opts.pkgs, flags.update)
    const pkgs = consolidate(xopts.pkgs)
    await ensure_pantry()
    if (args[0] == 'sh') {
      await repl(args.slice(1), { update, pkgs, logger })
    } else {
      await x(args, { update, pkgs, logger })
    }
  } break
  case 'integrate':
    await integrate('install')
    break
  case 'internal.use': {
    await ensure_pantry()
    const xopts = await parse_xopts(opts.pkgs, flags.update)
    const rv = await internal_use({ ...xopts, logger })
    if (rv) {
      console.log(rv.shellcode)
      console.error('tea:', rv.pkgenv.map(x => `+${utils.pkg.str(x)}`).join(' '))
    }
  } break
  case 'internal.activate': {
    await ensure_pantry()
    const [shellcode, pkgs] = await internal_activate(opts.dir, { logger })
    console.error(`%ctea %c%s`, 'color: #00FFD0', 'color: initial', pkgs.map(x => `+${utils.pkg.str(x)}`).join(' '))
    console.log(shellcode)
    if (Deno.env.get("TERM_PROGRAM") == "vscode") {
      console.error("tea: you may need to: ⌘⇧P workbench.action.reloadWindow")
    }
  } break
  case 'install':
    await ensure_pantry()
    await install(await Promise.all(opts.args.map(x => parse_pkg_str(x, {latest: 'ok'}))))
    break
  case 'deintegrate':
    await integrate('uninstall')
    break
  case 'shellcode':
    console.log(shellcode())
    break
  case 'help':
    console.log(help(flags.verbosity))
    break
  case 'run': {
    await ensure_pantry()
    const { update, pkgs: xopts } = await parse_xopts(opts.pkgs, flags.update)
    const pkgs = consolidate(xopts)
    await run(opts.args, { pkgs, update, logger })
  } break
  case 'env': {
    await ensure_pantry()
    const { update, pkgs: xopts } = await parse_xopts(opts.pkgs, flags.update)
    const pkgs = consolidate(xopts)
    console.log(await env({pkgs, update, logger}))
  } break
  case 'version':
    console.log(`tea ${version()}`)
    break
  case 'shell-completion':
    console.log(await shell_completion(opts.args).then(x => x.join(" ")))
    break
  case 'which': {
    const programs = await which(opts.args)
    console.log(programs.join(" "))
    Deno.exit(programs.length ? 0 : 1)
  }}
}

async function ensure_pantry() {
  if (usePantry().missing()) {
    await useSync()
  }
}

function make_logger(verbosity: number, logger_prefix?: string): IInstallLogger {
  const logger = new Logger(logger_prefix)
  if (verbosity <= -2) {
    return {
      replace: () => {},
      clear: () => {},
      upgrade: () => undefined
    }
  } else if (verbosity == -1) {
    return {
      replace: logger.replace.bind(logger),
      clear: logger.clear.bind(logger),
      upgrade: () => ({
        installed: ({path}) => {
          logger.replace(`${teal('cached')} ${path}`, {prefix: false})
        }
      })
    }
  } else {
    return {
      replace: logger.replace.bind(logger),
      clear: logger.clear.bind(logger),
      upgrade: function(dry: PackageSpecification[], pending: Package[]) {
        return new InstallLogger(dry, pending, logger)
      }
    }
  }
}

async function parse_xopts(input: { plus: string[], minus: string[] }, update_all: boolean) {
  const update: Set<string> = new Set()

  const plus: PackageRequirement[] = []
  for (const promise of input.plus.map(x => parse_pkg_str(x, { latest: 'ok' }))) {
    const { update: up, ...pkg } = await promise
    plus.push(pkg)
    if (up) update.add(pkg.project)
  }

  const minus = await Promise.all(input.minus.map(x => parse_pkg_str(x)))
  const active = flatmap(Deno.env.get("TEA_POWDER"), x => x.split(" ").map(utils.pkg.parse)) ?? []

  const pkgs = { plus, minus, active }

  if (update_all) {
    return { pkgs, update: true }
  } else if (update.size > 0 ) {
    return { pkgs, update }
  } else {
    return { pkgs, update: false }
  }
}

function consolidate({ plus, minus, active}: { plus: PackageRequirement[], minus: PackageRequirement[], active: PackageRequirement[] }) {
  for (const { project } of minus) {
    //TODO this is insufficient
    active = active.filter(x => x.project != project)
  }
  return [...active, ...plus]
}
