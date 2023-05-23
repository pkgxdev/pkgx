import { PackageSpecification, Package, utils, Installation, prefab } from "tea"
const { hydrate, link, resolve, install } = prefab
import useLogger, { Logger } from "./useLogger.ts"
import { ExitError } from "./useErrorHandler.ts"
import useConfig from "./useConfig.ts"
import undent from "outdent"

export default async function(pkgs: PackageSpecification[], update: boolean) {
  const { modifiers: { json, dryrun }, env, prefix } = useConfig()
  const logger = useLogger().new()
  const { logJSON, gray } = useLogger()

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

  for (const pkg of pending) {
    let installation: Installation
    const logger = useLogger().new(gray(utils.pkg.str(pkg)))

    if (dryrun) {
      installation = { pkg, path: prefix.join(pkg.project, `v${pkg.version}`) }
      log_installed_msg(pkg, 'imagined', logger)
    } else {
      installation = await i(pkg, logger)
      await link(installation)
    }

    installed.push(installation)
  }

  return { installed, dry }
}

async function i(pkg: Package, logger: Logger) {
  const { modifiers: { json, verbosity } } = useConfig()
  const { logJSON, teal, gray } = useLogger()

  let bytes = 0
  let content_size: number | undefined
  const timestamp = Date.now()

  return await install(pkg, {
    locking: () => {
      if (!json) {
        logger.replace(teal("locking"))
      } else {
        logJSON({status: "locking", pkg: utils.pkg.str(pkg) })
      }
    },
    /// raw http info
    downloading: ({pkg, src, dst, rcvd, total}) => {
      if (json) {
        logJSON({status: "downloading", "received": rcvd, "content-size": total, pkg, src, dst })
      } else if (verbosity >= 0) {
        bytes = rcvd ?? 0
        content_size = total
      } else if (total) {
        content_size = total
        logger.replace(`${teal('installing')} ${gray(pretty_size(total))}`)
      } else {
        logger.replace(`${teal('installing')}`)
      }
    },
    installing: ({pkg, progress}) => {
      if (json) {
        logJSON({status: "installing", pkg, progress })
      } else if (verbosity >= 0) {
        let s = teal("installing")

        let pc = (progress ?? 0) * 100;
        pc = pc < 1 ? Math.round(pc) : Math.floor(pc);  // don’t say 100% at 99.5%

        s += ` ${pc}%`.padEnd(4, ' ')

        const duration = Date.now() - timestamp
        if (duration > 0) {
          const speed = bytes / duration * 1000
          let dl = pretty_size(speed)
          dl += "/s"
          s += ` ${gray(dl)}`
        }

        if (content_size) {
          const a = pretty_size(bytes)
          const b = pretty_size(content_size)
          s += ` ${gray(`${a}/${b}`)}`
        }

        logger.replace(s)
      }
    },
    unlocking: (pkg: Package) => {
      if (json) logJSON({status: "unlocking", pkg: utils.pkg.str(pkg) })
    },
    installed: (installation: Installation) => {
      log_installed_msg(installation.pkg, 'installed', logger)
    }
  })
}


////////////////// utils //////////////////

function pretty_size(n: number) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"]
  let i = 0
  while (n > 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  const precision = n < 10 ? 2 : n < 100 ? 1 : 0
  return `${n.toFixed(precision)} ${units[i]}`
}

const log_installed_msg = (pkg: Package, title: string, logger: Logger) => {
  const { prefix, modifiers: { json } } = useConfig()
  const { gray, logJSON } = useLogger()

  const pkg_prefix_str = (pkg: Package) => [
    gray(prefix.prettyString()),
    pkg.project,
    `${gray('v')}${pkg.version}`
  ].join(gray('/'))

  if (json) {
    logJSON({status: title, pkg: utils.pkg.str(pkg)})
  } else {
    const str = pkg_prefix_str(pkg)
    logger!.replace(`${title}: ${str}`, { prefix: false })
  }
}
