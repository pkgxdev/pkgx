import { PackageSpecification, Package, utils, Installation, plumbing, Path } from "tea"
import { Logger as InstallLogger } from "tea/plumbing/install.ts"
const { hydrate, link: base_link, resolve, install } = plumbing
import useConfig, { Verbosity } from "../hooks/useConfig.ts"
import useLogger, { Logger } from "../hooks/useLogger.ts"
import { ExitError } from "../hooks/useErrorHandler.ts"
import usePantry from "tea/hooks/usePantry.ts"
import undent from "outdent"
import host from "https://raw.githubusercontent.com/teaxyz/lib/v0.4.2/src/utils/host.ts"

//TODO we should use even more plumbing to ensure pkgs aren’t moved into
// TEA_PREFIX until all their deps are moved in

export default async function(pkgs: PackageSpecification[], update: boolean) {
  const { modifiers: { json, dryrun, verbosity }, env, prefix } = useConfig()
  const logger = useLogger().new()
  const { logJSON, teal } = useLogger()

  if (json) {
    logJSON({ status: "resolving" })
  } else if (verbosity > Verbosity.quiet) {
    logger.replace("resolving package graph")
  } else {
    logger.replace(`${teal("resolving")} ${pkgs.map(utils.pkg.str).join(", ")}`)
  }

  const { pkgs: wet, dry } = await hydrate(pkgs)
  const {installed, pending} = await resolve(wet, { update })

  if (json) {
    logJSON({ status: "resolved", pkgs: pending.map(utils.pkg.str) })
  } else {
    if (verbosity > Verbosity.quiet) {
      logger.clear()
    } else if (pending.length) {
      logger.replace(`${teal("installing")} ${pending.map(utils.pkg.str).join(", ")}`)
    }
    console.debug({hydrating: pkgs})
  }

  if (!dryrun && env.TEA_MAGIC?.split(':').includes("prompt")) {
    if (!Deno.isatty(Deno.stdin.rid)) {
      throw new Error("TEA_MAGIC=prompt but stdin is not a tty")
    }

    do {
      const val = prompt(undent`
        ┌ ⚠️  tea requests to install: ${pending.map(utils.pkg.str).join(", ")}
        └ \x1B[1mallow?\x1B[0m [y/n]`
      )?.toLowerCase()

      if (val === "y") {
        break
      }
      if (val === "n") {
        throw new ExitError(1)
      }
    } while (true)
  }

  //TODO json mode
  if (!dryrun) {
    const mlogger = json
      ? JSONLogger()
      : verbosity > Verbosity.quiet
        ? new MultiLogger(pending, logger)
        : QuietLogger(logger)
    const ops = pending
      .map(pkg => install(pkg, mlogger)
        .then(link))
    installed.push(...await Promise.all(ops))
    logger.clear()  // clears install progress
  } else for (const pkg of pending) {
    const installation = { pkg, path: prefix.join(pkg.project, `v${pkg.version}`) }
    log_installed_msg(pkg, 'imagined', logger)
    installed.push(installation)
  }

  return { installed, dry }
}

const log_installed_msg = (pkg: Package, title: string, logger: Logger) => {
  const { prefix, modifiers: { json } } = useConfig()
  const { gray } = useLogger()

  console.assert(!json)

  const pkg_prefix_str = (pkg: Package) => [
    gray(prefix.prettyString()),
    pkg.project,
    `${gray('v')}${pkg.version}`
  ].join(gray('/'))

  const str = pkg_prefix_str(pkg)
  logger!.replace(`${title}: ${str}`, { prefix: false })
}


////////////////// utils //////////////////

function pretty_size(n: number, fixed?: number): [string, number] {
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
  let i = 0
  let divisor = 1
  while (n > 1024) {
    n /= 1024
    i++
    divisor *= 1024
  }
  return [`${n.toFixed(fixed ?? precision(n))} ${units[i]}`, divisor]
}

function precision(n: number) {
  return n < 10 ? 2 : n < 100 ? 1 : 0
}

class MultiLogger implements InstallLogger {
  projects: string[]
  rcvd: Record<string, number> = {}
  totals: Record<string, number> = {}
  progress: Record<string, number> = {}
  logger: Logger
  start = Date.now()

  constructor(pkgs: Package[], logger: Logger) {
    this.projects = pkgs.map(x => x.project)
    for (const project in this.projects) {
      this.rcvd[project] = 0
      this.totals[project] = 0
    }
    this.logger = logger
  }

  downloading({ pkg: { project }, rcvd, total }: { pkg: Package; src?: URL|undefined; dst?: Path|undefined; rcvd?: number|undefined; total?: number|undefined; }): void {
    if (!rcvd || !total) return
    this.rcvd[project] = rcvd
    this.totals[project] = total
    this.update()
  }

  installing({ pkg: { project }, progress }: { pkg: Package; progress: number|undefined; }): void {
    if (!progress) return
    this.progress[project] = progress
    this.update()
  }

  locking(pkg: Package): void {
    if (!this.total_progress()) {
      const { teal } = useLogger()
      this.logger.replace(`${teal("locking")} ${utils.pkg.str(pkg)}`)  //TODO
    }
  }
  unlocking(_pkg: Package): void {}

  installed(installation: Installation): void {
    log_installed_msg(installation.pkg, 'installed', this.logger)
    this.logger.reset()
    this.update()
  }

  private total_rcvd(): number {
    return Object.values(this.rcvd).reduce((a, b) => a + b, 0)
  }

  private total_progress(): number {
    let total_untard_bytes = 0
    for (const project of this.projects) {
      const bytes = this.progress[project] * this.totals[project]
      total_untard_bytes += bytes
    }
    return total_untard_bytes / Object.values(this.totals).reduce((a, b) => a + b, 0)
  }

  private update() {
    const { teal, gray } = useLogger()
    let str = ''

    const pc = this.total_progress()
    let prefix: string
    if (!isNaN(pc)) {
      str = `${(pc * 100).toFixed()}% `
      prefix = 'installing'
    } else {
      prefix = 'downloading'
    }

    const rcvd = this.total_rcvd()
    const total = Object.values(this.totals).reduce((a, b) => a + b, 0)

    const speed = this.total_rcvd() / (Date.now() - this.start) * 1000
    str += gray(`${pretty_size(speed)[0]}/s`)

    if (rcvd && total) {
      const [pretty_total, divisor] = pretty_size(total, 0)
      const n = rcvd / divisor
      const pretty_rcvd = n.toFixed(precision(n))
      str += gray(` ${pretty_rcvd}/${pretty_total}`)
    }

    this.logger.replace(`${teal(prefix)} ${str}`)
  }
}

function JSONLogger(): InstallLogger {
  const { logJSON } = useLogger()
  return {
    locking(pkg: Package): void {
      logJSON({status: "locking", pkg: utils.pkg.str(pkg) })
    },
    /// raw http info
    downloading({pkg, src, dst, rcvd, total}: {pkg: Package, src?: URL, dst?: Path, rcvd?: number, total?: number}): void {
      logJSON({status: "downloading", "received": rcvd, "content-size": total, pkg, src, dst })
    },
    installing({pkg, progress}: {pkg: Package, progress: number | undefined}): void {
      logJSON({status: "installing", pkg, progress })
    },
    unlocking(pkg: Package): void {
      logJSON({status: "unlocking", pkg: utils.pkg.str(pkg) })
    },
    installed(installation: Installation): void {
      logJSON({status: "installed", pkg: utils.pkg.str(installation.pkg), path: installation.path})
    }
  }
}

function QuietLogger(logger: Logger): InstallLogger {
  return {
    installed(installation: Installation): void {
      log_installed_msg(installation.pkg, 'installed', logger)
    }
  }
}

async function link(installation: Installation) {
  const pp: Promise<void>[] = []

  pp.push(base_link(installation))

  const { prefix: TEA_PREFIX } = useConfig()
  const bin = TEA_PREFIX.join(".local/bin")
  const tea = TEA_PREFIX.join("tea.xyz/v*/bin/tea").isExecutableFile()

  if (host().platform == 'darwin') {
    // currently we only do this on macOS because Linux will not
    // provide the symlink as arg0 to the executable
    // we can work around this using shim shell scripts but that’s more work

    const provides = await usePantry().project(installation.pkg).provides()

    /// we only do auto-POSIX symlinking if tea is installed properly
    if (tea && provides.length) {
      const tealink = bin.mkdir('p').join("tea")
      if (!tealink.exists()) {
        const p = Deno.symlink(tea.relative({ to: bin }), tealink.string)
        pp.push(p)
      }
      for (const exename of provides) {
        const target = bin.join(exename)
        if (!target.exists()) {
          const p = Deno.symlink("tea", target.string)
          pp.push(p)
        }
      }
    }
  }

  await Promise.all(pp)

  return installation
}
