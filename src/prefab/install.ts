import useCache from "hooks/useCache.ts"
import { Package } from "types"
import usePlatform from "hooks/usePlatform.ts"
import useCellar from "hooks/useCellar.ts"
import { Installation } from "types"
import { TarballUnarchiver } from "utils/Unarchiver.ts"
import useFlags from "hooks/useFlags.ts"
import { run } from "utils"

// # NOTE
// *only installs binaries*
// > to install from source you must use `$SRCROOT/scripts/build.ts`

// # contract
// - if already installed, will extract over the top

export default async function install(pkg: Package): Promise<Installation> {
  const { project, version } = pkg
  const { platform, arch } = usePlatform()
  const url = `https://s3.amazonaws.com/dist.tea.xyz/${project}/${platform}/${arch}/v${version}.tar.gz`
  const { prefix: dstdir, ...cellar } = useCellar()
  const { verbosity } = useFlags()

  const tarball = await useCache().download({ url, pkg: { project, version } })

  const cmd = new TarballUnarchiver({
    zipfile: tarball, dstdir, verbosity
  }).args()

  // clearEnv requires unstable API
  await run({ cmd/*, clearEnv: true*/ })

  const install = await cellar.resolve(pkg)

  if (Deno.build.os == 'darwin') {
    /// for now, prevent gatekeeper prompts FIXME sign everything!
    await run({ cmd: ['xattr', '-rd', 'com.apple.quarantine', install.path.string] })
  }

  return install
}
