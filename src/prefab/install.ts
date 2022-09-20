import { usePrefix, useCache, useCellar, useFlags, useDownload } from "hooks"
import { run, TarballUnarchiver, host } from "utils"
import { encode } from "deno/encoding/hex.ts"
import { crypto } from "deno/crypto/mod.ts"
import { Installation } from "types"
import { Package } from "types"
import Path from "path"

// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT../pantry/scripts/build.ts`

// # contract
// - if already installed, will extract over the top
// - files not in the newer archive will not be deleted

export default async function install(pkg: Package): Promise<Installation> {
  const { project, version } = pkg
  const { s3Key, download } = useCache()
  const url = new URL(`https://dist.tea.xyz/${s3Key(pkg)}`)
  const cellar = useCellar()
  const { verbosity } = useFlags()
  const dstdir = usePrefix()

  const tarball = await download({ url, pkg: { project, version } })

  try {
    const sha_url = new URL(`${url}.sha256sum`)
    await sumcheck(tarball, sha_url, pkg)
  } catch (err) {
    tarball.rm()
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

async function sumcheck(tarball: Path, url: URL, pkg: Package) {
  const { download } = useDownload()
  const dst = new Path(`${useCache().bottle(pkg)}.sha256sum`)

  const local = Deno.open(tarball.string, { read: true })
    .then(file => crypto.subtle.digest("SHA-256", file.readable))
    .then(buf => new TextDecoder().decode(encode(new Uint8Array(buf))))

  const remote = console.silence(() =>
    download({ src: url, dst, ephemeral: true })
  ).then(async dl => {
    const txt = await dl.read()
    return txt.split(' ')[0]
  })

  const [remote_SHA, local_SHA] = await Promise.all([remote, local])

  console.verbose({ remote_SHA, local_SHA })

  if (remote_SHA != local_SHA) {
    throw new Error(`expected: ${remote_SHA}`)
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
