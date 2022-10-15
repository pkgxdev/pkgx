import { usePrefix, useCache, useCellar, useFlags, useDownload, useOffLicense } from "hooks"
import { copy } from "deno/streams/conversion.ts"
import { run, TarballUnarchiver, host } from "utils"
import { Installation } from "types"
import { isString } from "is_what"
import { Package } from "types"
import { Sha256 } from "deno/hash/sha256.ts"
import Path from "path"

// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT../pantry/scripts/build.ts`

// # contract
// - if already installed, will extract over the top
// - files not in the newer archive will not be deleted

export default async function install(pkg: Package): Promise<Installation> {
  const { project, version } = pkg
  const { download } = useCache()

  const cellar = useCellar()
  const { verbosity } = useFlags()
  const dstdir = usePrefix()
  const { path: tarball, sha } = await download({ type: 'bottle', pkg: { project, version } })

  try {
    const url = useOffLicense('s3').url({pkg, compression: 'gz', type: 'bottle'})
    await sumcheck(sha ?? tarball, new URL(`${url}.sha256sum`))
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

async function sumcheck(tarball: Path | string, url: URL) {
  const { download } = useDownload()

  const local = (async () => {
    if (isString(tarball)) {
      return tarball
    } else {
      // slow option :/
      const digest = new Sha256()
      const f = await Deno.open(tarball.string, { read: true })
      await copy(f, { write: buf => {
        //TODO in separate thread would be likely be faster
        digest.update(buf)
        return Promise.resolve(buf.length)
      }})
      return digest.hex()
    }
  })()

  const remote = console.silence(() =>
    download({ src: url, ephemeral: true, mehsha: true })
  ).then(async ({ path: dl }) => {
    const txt = await dl.read()
    return txt.split(' ')[0]
  })

  const [remote_SHA, local_SHA] = await Promise.all([remote, local])

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
