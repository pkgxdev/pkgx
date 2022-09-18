import useCache from "hooks/useCache.ts"
import { Package, Path } from "types"
import usePlatform from "hooks/usePlatform.ts"
import useCellar from "hooks/useCellar.ts"
import { Installation } from "types"
import { TarballUnarchiver } from "utils/Unarchiver.ts"
import useFlags from "hooks/useFlags.ts"
import { run } from "utils"
import { crypto } from "deno/crypto/mod.ts"
import { encodeToString } from "encodeToString"
import useDownload from "hooks/useDownload.ts"


// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT/scripts/build.ts`

// # contract
// - if already installed, will extract over the top

export default async function install(pkg: Package): Promise<Installation> {
  const { project, version } = pkg
  const { finalizeInstall } = usePlatform()
  const { s3Key, download } = useCache()
  const url = new URL(`https://dist.tea.xyz/${s3Key(pkg)}`)
  const { prefix: dstdir, ...cellar } = useCellar()
  const { verbosity } = useFlags()

  const tarball = await download({ url, pkg: { project, version } })

  try {
    const sha_url = new URL(`${url}.sha256sum`)
    await validateChecksum(tarball, sha_url, pkg)
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

  await finalizeInstall(install)

  return install
}

//TODO strictly the checksum file needs to be rewritten
//TODO so instead download to default cache path and write a checksum file for all bottles/srcs
//FIXME there is a potential attack here since download streams to a file
//  and AFTER we read back out of the file, a malicious actor could rewrite the file
//  in that gap. Also it’s less efficient.

async function validateChecksum(tarball: Path, url: URL, pkg: Package) {
  const { download } = useDownload()
  const dst = new Path(`${useCache().bottle(pkg)}.sha256sum`)

  const local = Deno.open(tarball.string, { read: true })
    .then(file => crypto.subtle.digest("SHA-256", file.readable))
    .then(buf => encodeToString(new Uint8Array(buf)))

  const remote = console.silence(() =>
    download({ src: url, dst, force: true })
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
