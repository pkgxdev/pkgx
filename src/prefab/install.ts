import { usePrefix, useCache, useCellar, useFlags, useDownload, useOffLicense } from "hooks"
import { run, TarballUnarchiver, host, pkg as pkgutils } from "utils"
import { Installation, StowageNativeBottle } from "types"
import { Logger, red, teal, gray } from "hooks/useLogger.ts"
import { Package } from "types"

// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT../pantry/scripts/build.ts`

// # contract
// - if already installed, will extract over the top
// - files not in the newer archive will not be deleted

export default async function install(pkg: Package, logger?: Logger): Promise<Installation> {
  const { project, version } = pkg
  logger ??= new Logger(pkgutils.str(pkg))

  const { download_with_sha: download } = useDownload()
  const cellar = useCellar()
  const { verbosity, dryrun } = useFlags()
  const dstdir = usePrefix()
  const compression = get_compression()
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const dst = useCache().path(stowage)
  const vdirname = `v${pkg.version}`

  const log_install_msg = (install: Installation, title = 'installed') => {
    const str = [
      gray(usePrefix().prettyString()),
      install.pkg.project,
      `${gray('v')}${install.pkg.version}`
    ].join(gray('/'))
    logger!.replace(`${title}: ${str}`, { prefix: false })
  }

  if (dryrun) {
    const install = { pkg, path: dstdir.join(pkg.project, vdirname) }
    log_install_msg(install, 'imagined')
    return install
  }

  const lock_dir = dstdir.join(pkg.project)
  const atomic_dstdir = lock_dir.join(`tmp.${vdirname}`)

  logger.replace(teal("locking"))

  const { rid } = await Deno.open(lock_dir.mkpath().string)
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

    //FIXME if we already have the gz or xz versions don’t download the other version!
    const { path: tarball, sha } = await download({ src: url, dst, logger })

    try {
      const url = useOffLicense('s3').url({pkg, compression, type: 'bottle'})
      logger.replace(teal("verifying"))
      await sumcheck(sha, new URL(`${url}.sha256sum`))
    } catch (err) {
      logger.replace(red('error'))
      tarball.rm()
      console.error("we deleted the invalid tarball. try again?")
      throw err
    }

    const cmd = new TarballUnarchiver({
      zipfile: tarball, dstdir: atomic_dstdir.mkpath(), verbosity, stripComponents: 2
    }).args()

    logger.replace(teal('extracting'))

    await run({ cmd, clearEnv: true })

    // we have accidentally bottled some bottles with a `./` prefix which counts
    // as one component when stripping them. ugh.
    if (atomic_dstdir.join(vdirname).isDirectory()) {
      atomic_dstdir.join(vdirname).mv({ into: lock_dir })
      atomic_dstdir.rm()
    } else {
      atomic_dstdir.mv({ to: lock_dir.join(vdirname) })
    }

    //FIXME unecessary compute
    const install = await cellar.resolve(pkg)

    log_install_msg(install)

    return install

  } finally {
    await Deno.funlock(rid)
    Deno.close(rid)  // docs aren't clear if we need to do this or not
  }
}

//TODO strictly the checksum file needs to be rewritten
//TODO so instead download to default cache path and write a checksum file for all bottles/srcs
//FIXME there is a potential attack here since download streams to a file
//  and AFTER we read back out of the file, a malicious actor could rewrite the file
//  in that gap. Also it’s less efficient.

async function sumcheck(local_SHA: string, url: URL) {
  const remote_SHA = await (async () => {
    const rsp = await fetch(url)
    if (!rsp.ok) throw rsp
    const txt = await rsp.text()
    return txt.split(' ')[0]
  })()

  console.verbose({ remote_SHA, local_SHA })

  if (remote_SHA != local_SHA) {
    throw {expected: remote_SHA, got: local_SHA}
  }
}

function get_compression() {
  if (Deno.env.get("CI")) return 'gz' // in CI CPU is more constrained than bandwidth
  if (host().platform == 'darwin') return 'xz' // most users are richer in CPU than bandwidth
  // TODO determine if `tar` can handle xz
  return 'gz'
}
