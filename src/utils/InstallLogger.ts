import { PackageSpecification, Package, utils, Path, Installation } from "pkgx"
import { Logger as BaseInstallLogger } from "pkgx/plumbing/install.ts"
import { blurple, inverse_blurple, dim } from "./color.ts"
import useConfig from "pkgx/hooks/useConfig.ts"
import Logger from "./Logger.ts"

export default class implements BaseInstallLogger {
  projects: string[]
  rcvd: Record<string, number> = {}
  totals: Record<string, number> = {}
  progress: Record<string, number> = {}
  logger: Logger
  start = Date.now()
  installed_count: number
  context: string

  constructor(dry: PackageSpecification[], pkgs: Package[], logger: Logger) {
    this.projects = pkgs.map(x => x.project)
    this.installed_count = 0
    this.context = dry.map(utils.pkg.str).join(', ')
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
      this.logger.replace(`${blurple("locking")} ${utils.pkg.str(pkg)}`)  //TODO
    }
  }
  unlocking(_pkg: Package): void {}

  installed(installation: Installation): void {
    this.installed_count++
    log_installed_msg(installation.pkg, inverse_blurple(' ✓ '), this.logger)
    this.logger.newln()
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
    let str = ''

    const pc = this.total_progress()
    let prefix: string
    if (!isNaN(pc)) {
      str = `${(pc * 100).toFixed()}% `
      prefix = blurple('installing')
    } else {
      prefix = blurple('downloading')
    }

    prefix += ` ${this.context} (${this.installed_count}⁄${this.projects.length})`

    const rcvd = this.total_rcvd()
    const total = Object.values(this.totals).reduce((a, b) => a + b, 0)

    const speed = this.total_rcvd() / (Date.now() - this.start) * 1000
    str += dim(`${pretty_size(speed)[0]}/s`)

    if (rcvd && total) {
      const [pretty_total, divisor] = pretty_size(total, 0)
      const n = rcvd / divisor
      const pretty_rcvd = n.toFixed(precision(n))
      str += dim(` ${pretty_rcvd}/${pretty_total}`)
    }

    this.logger.replace(`${prefix} ${str}`)
  }
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

const log_installed_msg = (pkg: Package, title: string, logger: Logger) => {
  const { prefix } = useConfig()
  const pkg_prefix_str = (pkg: Package) => [
    dim(prefix.prettyString()),
    pkg.project,
    `${dim('v')}${pkg.version}`
  ].join(dim('/'))

  const str = pkg_prefix_str(pkg)
  logger!.replace(`${title} ${str}`, { prefix: false })
}
