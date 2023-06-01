import { PackageSpecification, Package, utils, Installation, prefab, Path } from "tea"
import { Logger as InstallLogger } from "tea/prefab/install.ts"
const { hydrate, link, resolve, install } = prefab
import useLogger, { Logger } from "./useLogger.ts"
import { ExitError } from "./useErrorHandler.ts"
import useConfig from "./useConfig.ts"
import undent from "outdent"

//TODO we should use even more plumbing to ensure pkgs aren’t moved into
// TEA_PREFIX until all their deps are moved in

export default async function(pkgs: PackageSpecification[], update: boolean) {
  const { modifiers: { json, dryrun }, env } = useConfig()
  const logger = useLogger().new()
  const { logJSON } = useLogger()

  if (!json) {
    logger.replace("resolving package graph")
  } else {
    logJSON({ status: "resolving" })
  }

  const { pkgs: wet, dry } = await hydrate(pkgs)
  const {installed, pending} = await resolve(wet, { update })

  if (json) {
    logJSON({ status: "resolved", pkgs: pending.map(utils.pkg.str) })
  } else {
    logger.clear()
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
  const mlogger = new MultiLogger(pending, logger)
  const ops = pending
    .map(pkg => install(pkg, mlogger)
      .then(async i => { await link(i); return i }))
  installed.push(...await Promise.all(ops))

  logger.clear()

  return { installed, dry }
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

  locking(_pkg: Package): void {}
  unlocking(_pkg: Package): void {}

  installed(installation: Installation): void {
    const { prefix } = useConfig()
    const { gray } = useLogger()

    const pkg_prefix_str = (pkg: Package) => [
      gray(prefix.prettyString()),
      pkg.project,
      `${gray('v')}${pkg.version}`
    ].join(gray('/'))

    const pkgstr = pkg_prefix_str(installation.pkg)
    const str = `installed: ${pkgstr}`
    this.logger.replace(str)
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
