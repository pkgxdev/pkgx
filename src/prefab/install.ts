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

  logger.replace(teal("querying"))

  const { download_with_sha: download } = useDownload()
  const cellar = useCellar()
  const { verbosity } = useFlags()
  const dstdir = usePrefix()
  const compression = get_compression()
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const dst = useCache().path(stowage)
  const { path: tarball, sha } = await download({ src: url, dst, logger })

  //FIXME if we already have the gz or xz versions don’t download the other version!

  try {
    const url = useOffLicense('s3').url({pkg, compression, type: 'bottle'})
    logger.replace(teal("verifying"))
    await sumcheck(sha, new URL(`${url}.sha256sum`))
  } catch (err) {
    logger.replace(`${red('error')}: ${err}`)
    tarball.rm()
    console.error("we deleted the invalid tarball. try again?")
    throw err
  }

  const cmd = new TarballUnarchiver({
    zipfile: tarball, dstdir, verbosity
  }).args()

  logger.replace(teal('extracting'))

  await run({ cmd, clearEnv: true })

  const install = await cellar.resolve(pkg)

  await unquarantine(install)

  const str = [
    gray(usePrefix().prettyString()),
    install.pkg.project,
    `${gray('v')}${install.pkg.version}`
  ].join(gray('/'))
  logger.replace(`installed: ${str}`, { prefix: false })

  return install
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

async function unquarantine(install: Installation) {
  if (host().platform != 'darwin') return

  /// for now, prevent gatekeeper prompts FIXME sign everything!

  // using find because it doesn’t error if it fails
  // and it does fail if the file isn’t writable, but we don’t want to make everything writable
  // unless we are forced into that in the future

  const cmd = [
    'find', install.path,
      '-xattrname', 'com.apple.quarantine',
      '-perm', '-0200',  // only if we can write (prevents error messages)
      '-exec', 'xattr', '-d', 'com.apple.quarantine', '{}', ';'
  ]

  await run({ cmd })
}

function get_compression() {
  if (Deno.env.get("CI")) return 'gz' // in CI CPU is more constrained than bandwidth
  if (host().platform == 'darwin') return 'xz' // most users are richer in CPU than bandwidth
  // TODO determine if `tar` can handle xz
  return 'gz'
}
