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

  const log_install_msg = (install: Installation, title = 'installed') => {
    const str = [
      gray(usePrefix().prettyString()),
      install.pkg.project,
      `${gray('v')}${install.pkg.version}`
    ].join(gray('/'))
    logger!.replace(`${title}: ${str}`, { prefix: false })
  }

  if (dryrun) {
    const install = { pkg, path: dstdir.join(pkg.project, `v${pkg.version}`) }
    log_install_msg(install, 'imagined')
    return install
  }

  logger.replace(teal("locking"))

  const { rid } = await Deno.open(dstdir.string)
  await Deno.flock(rid, true)

  try {
    await (async () => {
      const installation = await cellar.has(pkg)
      if (installation) {
        logger.replace(teal("installed"))
        return installation
      }
    })()

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
      zipfile: tarball, dstdir, verbosity
    }).args()

    logger.replace(teal('extracting'))

    await run({ cmd, clearEnv: true })

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
