import { usePrefix, useCache, useCellar, useDownload, useOffLicense, useFetch, useConfig } from "hooks"
import { host, panic, pkg as pkgutils, undent } from "utils"
import useLogger, { Logger, red, teal, gray, logJSON } from "hooks/useLogger.ts"
import { ExitError, Installation, StowageNativeBottle } from "types"
import { crypto, toHashString } from "deno/crypto/mod.ts"
import { Package } from "types"
import Path from "path"

export default async function install(pkg: Package, logger?: Logger): Promise<Installation> {
  const { project, version } = pkg
  logger ??= useLogger(pkgutils.str(pkg))

  const cellar = useCellar()
  const tea_prefix = usePrefix()
  const { isCI, dryrun, json, env } = useConfig()
  const compression = get_compression(isCI)
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const tarball = useCache().path(stowage)
  const shelf = tea_prefix.join(pkg.project)

  const pkg_prefix_str = (pkg: Package) => [
      gray(usePrefix().prettyString()),
      pkg.project,
      `${gray('v')}${pkg.version}`
    ].join(gray('/'))

  if (env.TEA_MAGIC === "prompt") {
    if (!Deno.isatty(Deno.stdin.rid)) {
      throw new Error("TEA_MAGIC=prompt but stdin is not a tty")
    }

    do {
      const val = prompt(undent`
        ┌ ⚠️  tea requests to install ${pkg_prefix_str(pkg)}
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

  const log_install_msg = (install: Installation, title = 'installed') => {
    if (json) {
      logJSON({status: title, pkg: pkgutils.str(install.pkg)})
    } else {
      const str = pkg_prefix_str(install.pkg)
      logger!.replace(`${title}: ${str}`, { prefix: false })
    }
  }

  if (dryrun) {
    const install = { pkg, path: tea_prefix.join(pkg.project, `v${pkg.version}`) }
    log_install_msg(install, 'imagined')
    return install
  }

  if (!json) {
    logger.replace(teal("locking"))
  } else {
    logJSON({status: "locking", pkg: pkgutils.str(pkg) })
  }
  const { rid } = await Deno.open(shelf.mkpath().string)
  await Deno.flock(rid, true)

  try {
    const already_installed = await cellar.has(pkg)
    if (already_installed) {
      // some other tea instance installed us while we were waiting for the lock
      // or potentially we were already installed and the caller is naughty
      if (!json) {
        logger.replace(teal("installed"))
      } else {
        logJSON({status: "installed", pkg: pkgutils.str(pkg) })
      }
      return already_installed
    }

    if (!json) {
      logger.replace(teal("querying"))
    } else {
      logJSON({status: "querying", pkg: pkgutils.str(pkg) })
    }

    let stream = await useDownload().stream({ src: url, logger, dst: tarball })
    const is_downloading = stream !== undefined
    stream ??= await Deno.open(tarball.string, {read: true}).then(f => f.readable) ?? panic()
    const tar_args = compression == 'xz' ? 'xJ' : 'xz'  // laughably confusing
    const tee = stream.tee()
    const pp: Promise<unknown>[] = []

    if (is_downloading) {  // cache the download (write stream to disk)
      tarball.parent().mkpath()
      const f = await Deno.open(tarball.string, {create: true, write: true, truncate: true})
      const teee = tee[1].tee()
      pp.push(teee[0].pipeTo(f.writable))
      tee[1] = teee[1]
    }

    const tmpdir = Path.mktemp({
      prefix: pkg.project.replaceAll("/", "_") + "_",
      dir: usePrefix().join("local/tmp")
      //NOTE ^^ inside tea prefix to avoid TMPDIR is on a different volume problems
    })
    const untar = new Deno.Command("tar", {
      args: [tar_args, "--strip-components", (pkg.project.split("/").length + 1).toString()],
      stdin: 'piped', stdout: "inherit", stderr: "inherit",
      cwd: tmpdir.string,
    }).spawn()

    pp.unshift(
      crypto.subtle.digest("SHA-256", tee[0]).then(toHashString),
      remote_SHA(new URL(`${url}.sha256sum`)),
      untar.status,
      tee[1].pipeTo(untar.stdin)
    )

    const [computed_hash_value, checksum, tar_exit_status] = await Promise.all(pp) as [string, string, Deno.CommandStatus]

    if (!tar_exit_status.success) {
      throw new Error(`tar exited with status ${tar_exit_status.code}`)
    }

    if (computed_hash_value != checksum) {
      if (!json) logger.replace(red('error'))
      tarball.rm()
      console.error("we deleted the invalid tarball. try again?")
      throw new Error(`sha: expected: ${checksum}, got: ${computed_hash_value}`)
    }

    const path = tmpdir.mv({ to: shelf.join(`v${pkg.version}`) })
    const install = { pkg, path }

    log_install_msg(install)

    return install
  } catch (err) {
    tarball.rm()  //FIXME resumable downloads!
    throw err
  } finally {
    await Deno.funlock(rid)
    Deno.close(rid)  // docs aren't clear if we need to do this or not
  }
}

async function remote_SHA(url: URL) {
  const rsp = await useFetch(url)
  if (!rsp.ok) throw rsp
  const txt = await rsp.text()
  return txt.split(' ')[0]
}

function get_compression(isCI: boolean) {
  if (isCI) return 'gz' // in CI CPU is more constrained than bandwidth
  if (host().platform == 'darwin') return 'xz' // most users are richer in CPU than bandwidth
  // TODO determine if `tar` can handle xz
  return 'gz'
}
