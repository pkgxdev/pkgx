import { usePrefix, useCache, useCellar, useFlags, useDownload, useOffLicense, useFetch } from "hooks"
import { host, panic, pkg as pkgutils } from "utils"
import { Logger, red, teal, gray } from "hooks/useLogger.ts"
import { Installation, StowageNativeBottle } from "types"
import { crypto, toHashString } from "deno/crypto/mod.ts"
import { Package } from "types"

export default async function install(pkg: Package, logger?: Logger): Promise<Installation> {
  const { project, version } = pkg
  logger ??= new Logger(pkgutils.str(pkg))

  const cellar = useCellar()
  const { dryrun } = useFlags()
  const tea_prefix = usePrefix()
  const compression = get_compression()
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const tarball = useCache().path(stowage)
  const vdirname = `v${pkg.version}`
  const shelf = tea_prefix.join(pkg.project)

  const log_install_msg = (install: Installation, title = 'installed') => {
    const str = [
      gray(usePrefix().prettyString()),
      install.pkg.project,
      `${gray('v')}${install.pkg.version}`
    ].join(gray('/'))
    logger!.replace(`${title}: ${str}`, { prefix: false })
  }

  if (dryrun) {
    const install = { pkg, path: tea_prefix.join(pkg.project, vdirname) }
    log_install_msg(install, 'imagined')
    return install
  }

  logger.replace(teal("locking"))
  const { rid } = await Deno.open(shelf.mkpath().string)
  await Deno.flock(rid, true)

  try {
    const already_installed = await cellar.has(pkg)
    if (already_installed) {
      // some other tea instance installed us while we were waiting for the lock
      // or potentially we were already installed and the caller is naughty
      logger.replace(teal("installed"))
      return already_installed
    }

    logger.replace(teal("querying"))

    let stream = await useDownload().stream({ src: url, logger, dst: tarball })
    const is_downloading = stream !== undefined
    stream ??= await Deno.open(tarball.string, {read: true}).then(f => f.readable) ?? panic()
    const tar_args = compression == 'xz' ? 'xJ' : 'xz'  // laughably confusing
    const tee = stream.tee()
    const pp: Promise<unknown>[] = []

    if (is_downloading) {  // cache the download
      tarball.parent().mkpath()
      const f = await Deno.open(tarball.string, {create: true, write: true, truncate: true})
      const teee = tee[1].tee()
      pp.push(teee[0].pipeTo(f.writable))
      tee[1] = teee[1]
    }

    const tmpdir = usePrefix().join("tmp").mkpath()
    const untar = new Deno.Command("tar", {
      args: [tar_args],
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
      throw new Error(`tar exited with status ${tar_exit_status}`)
    }

    if (computed_hash_value != checksum) {
      logger.replace(red('error'))
      tarball.rm()
      console.error("we deleted the invalid tarball. try again?")
      throw new Error(`sha: expected: ${checksum}, got: ${computed_hash_value}`)
    }

    const path = tmpdir.join(pkg.project, `v${pkg.version}`).mv({ into: shelf })
    const install = { pkg, path }

    log_install_msg(install)

    return install

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

function get_compression() {
  if (Deno.env.get("CI")) return 'gz' // in CI CPU is more constrained than bandwidth
  if (host().platform == 'darwin') return 'xz' // most users are richer in CPU than bandwidth
  // TODO determine if `tar` can handle xz
  return 'gz'
}
