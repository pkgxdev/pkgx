import useCache from "hooks/useCache.ts"
import { Package, Path } from "types"
import usePlatform from "hooks/usePlatform.ts"
import useCellar from "hooks/useCellar.ts"
import { Installation } from "types"
import { TarballUnarchiver } from "utils/Unarchiver.ts"
import useFlags from "hooks/useFlags.ts"
import { run } from "utils"
import { crypto } from "deno/crypto/mod.ts";
import { readAll, readerFromStreamReader } from "deno/streams/mod.ts";
import { encodeToString } from "encodeToString";


// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT/scripts/build.ts`

// # contract
// - if already installed, will extract over the top

export default async function install(pkg: Package): Promise<Installation> {
  const { project, version } = pkg
  const { finalizeInstall } = usePlatform()
  const { s3Key, download } = useCache()
  const url = `https://dist.tea.xyz/${s3Key(pkg)}`
  const { prefix: dstdir, ...cellar } = useCellar()
  const { verbosity } = useFlags()

  const tarball = await download({ url, pkg: { project, version } })

  try {
    await validateChecksum(tarball, `${url}.sha256sum`)
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

async function validateChecksum(tarball: Path, url: string) {
  const file = Deno.readFileSync(tarball.string)
  const fileSha256sum = encodeToString(new Uint8Array(await crypto.subtle.digest("SHA-256", file)))

  const rsp = await fetch(url)
  if (!rsp.ok) throw new Error(`404-not-found: ${url}`)
  const rdr = rsp.body?.getReader()
  if (!rdr) throw new Error(`Couldn’t read: ${url}`)
  const r = await readAll(readerFromStreamReader(rdr))
  const remoteSha256Sum = new TextDecoder().decode(r).split(' ')[0]

  console.verbose({ checksum: remoteSha256Sum })

  if (remoteSha256Sum !== fileSha256sum) {
    throw new Error(`expected: ${remoteSha256Sum}`)
  }
}