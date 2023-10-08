import { hooks, Package, PackageRequirement, PackageSpecification, utils } from "pkgx"
import { Logger as IInstallLogger } from "./prefab/install.ts"
import internal_activate from "./modes/internal.activate.ts"
import shell_completion from "./modes/shell-completion.ts"
import parse_pkg_str from "./prefab/parse-pkg-str.ts"
import InstallLogger from "./utils/InstallLogger.ts"
import { setColorEnabled } from "deno/fmt/colors.ts"
import internal_use from "./modes/internal.use.ts"
import { Args as BaseArgs } from "./parse-args.ts"
import { AmbiguityError } from "./utils/error.ts"
import integrate from "./modes/integrate.ts"
import uninstall from "./modes/uninstall.ts"
import shellcode from "./modes/shellcode.ts"
import provider from "./modes/provider.ts"
import clicolor from "./utils/clicolor.ts"
import { blurple } from "./utils/color.ts"
import install from "./modes/install.ts"
import version from "./modes/version.ts"
import Logger from "./utils/Logger.ts"
import help from "./modes/help.ts"
import repl from "./modes/repl.ts"
import env from "./modes/env.ts"
import x from "./modes/x.ts"

const { usePantry, useSync } = hooks
const { flatmap } = utils

type Args = BaseArgs & { flags: { verbosity: number } }

export default async function({ flags, ...opts }: Args, logger_prefix?: string) {
  if (flags.sync) {
    try {
      await useSync()  //TODO Logger
    } catch (err) {
      if (!flags.keepGoing) throw err
    }
  }

  const logger = make_logger(flags.verbosity, logger_prefix)

  switch (opts.mode) {
  case 'x': {
    const { args } = opts
    await ensure_pantry()
    const {update, ...xopts} = await parse_xopts(opts.pkgs, flags.update)
    const pkgs = consolidate(xopts.pkgs)
    if (args[0] == 'sh') {
      await repl(args.slice(1), { update, pkgs, logger })
    } else {
      await x({ args, unknown: opts.unknown, update, pkgs, logger })
    }
  } break
  case 'integrate':
    await integrate('install', opts)
    break
  case 'internal.use': {
    await ensure_pantry()
    const xopts = await parse_xopts(opts.pkgs, flags.update)
    const rv = await internal_use({ ...xopts, logger })
    if (rv) {
      console.log(rv.shellcode)
    }
  } break
  case 'internal.activate': {
    await ensure_pantry()
    const powder = flatmap(Deno.env.get("PKGX_POWDER"), x => x.split(/\s+/).map(utils.pkg.parse)) ?? []
    const [shellcode, pkgs] = await internal_activate(opts.dir, { powder, logger })
    console.error(`%s %s`, blurple('env'), pkgs.map(x => `+${utils.pkg.str(x)}`).join(' '))
    console.log(shellcode)
    if (Deno.env.get("TERM_PROGRAM") == "vscode") {
      console.error("pkgx: you may need to: ⌘⇧P workbench.action.reloadWindow")
    }
  } break
  case 'install':
    try {
      await ensure_pantry()
      await install(await Promise.all(opts.args.map(x => parse_pkg_str(x, {latest: 'ok'}))))
    } catch (err) {
      if (err instanceof AmbiguityError) {
        err.ctx = 'install'
      }
      throw err
    }
    break
  case 'uninstall':
    await uninstall(opts.args)
    break
  case 'deintegrate':
    await integrate('uninstall', opts)
    break
  case 'shellcode':
    console.log(shellcode())
    break
  case 'help':
    setColorEnabled(clicolor(Deno.stdout.rid))
    console.log(help(flags.verbosity))
    break
  case 'env': {
    await ensure_pantry()
    const { update, pkgs: xopts } = await parse_xopts(opts.pkgs, flags.update)
    const pkgs = consolidate(xopts)
    console.log(await env({pkgs, update, logger}))
  } break
  case 'version':
    console.log(`pkgx ${version()}`)
    break
  case 'shell-completion':
    console.log(await shell_completion(opts.args).then(x => x.join(" ")))
    break
  case 'provider': {
    const programs = await provider(opts.args)
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
  if (verbosity <= -2 || !Deno.isatty(Deno.stderr.rid)) {
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
          logger.replace(`${blurple('cached')} ${path}`, {prefix: false})
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
  const active = flatmap(Deno.env.get("PKGX_POWDER"), x => x.split(" ").map(utils.pkg.parse)) ?? []

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
