import { usePrefix, useCache, useCellar, useFlags, useDownload, useOffLicense } from "hooks"
import { run, TarballUnarchiver, host } from "utils"
import { Installation, StowageNativeBottle } from "types"
import { Package } from "types"

// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT../pantry/scripts/build.ts`

// # contract
// - if already installed, will extract over the top
// - files not in the newer archive will not be deleted

export default async function install(pkg: Package): Promise<Installation> {
  const { project, version } = pkg
  const { download_with_sha: download } = useDownload()
  const cellar = useCellar()
  const { verbosity } = useFlags()
  const dstdir = usePrefix()
  const compression = host().platform == 'darwin' ? 'xz' : 'gz'
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = await useOffLicense('ipfs').url(stowage)
  const dst = useCache().path(stowage)
  const { path: tarball, sha } = await download({ src: url, dst })

  //FIXME if we already have the gz or xz versions don’t download the other version!

  try {
    const url = useOffLicense('s3').url({pkg, compression, type: 'bottle'})
    await sumcheck(sha, new URL(`${url}.sha256sum`))
  } catch (err) {
    tarball.rm()
    console.error("we deleted the invalid tarball. try again?")
    throw err
  }

  const cmd = new TarballUnarchiver({
    zipfile: tarball, dstdir, verbosity
  }).args()

  // clearEnv requires unstable API
  await run({ cmd/*, clearEnv: true*/ })

  const install = await cellar.resolve(pkg)

  await unquarantine(install)

  return install
}

//TODO strictly the checksum file needs to be rewritten
//TODO so instead download to default cache path and write a checksum file for all bottles/srcs
//FIXME there is a potential attack here since download streams to a file
//  and AFTER we read back out of the file, a malicious actor could rewrite the file
//  in that gap. Also it’s less efficient.

async function sumcheck(local_SHA: string, url: URL) {
  const { download } = useDownload()

  const remote_SHA = await console.silence(() =>
    download({ src: url, ephemeral: true })
  ).then(async dl => {
    const txt = await dl.read()
    return txt.split(' ')[0]
  })

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
