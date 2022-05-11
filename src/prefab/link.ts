import { Package, semver, SemVer, Path, Bluff, Installation } from "types"
import * as _ from "utils"
import useCellar from "hooks/useCellar.ts"

export default async function link(pkg: Package) {
  const installation = useCellar().resolve(pkg)
  await lvl1(installation)
}

export async function lvl1(installation: Bluff<Installation>) {
  const versions = Promise.resolve(installation)
    .then(async ({ pkg }) => {
      const foo = await useCellar().ls(pkg.project)
      return foo.map(({pkg: {version}, path}) => [version, path] as [SemVer, Path])
    })
  await lvl2(installation, versions)
}

export async function lvl2(installation: Bluff<Installation>, versions: Bluff<[SemVer, Path][]>) {
  installation = await installation // GD I❤️TS
  versions = (await versions).sort(([a],[b]) => semver.compare(a,b))

  const shelf = installation.path.parent()
  const pkg = installation.pkg
  const newest = versions.slice(-1)[0]
  const vMm = `${pkg.version.major}.${pkg.version.minor}`
  const minorRange = new semver.Range(vMm)
  const mostMinor = versions.filter(v => semver.satisfies(v[0], minorRange)).slice(-1)[0]

  if (semver.neq(mostMinor[0], pkg.version)) return
  // ^^ if we’re not the most minor we definitely not the most major

  await makeSymlink(`v${vMm}`)

  const majorRange = new semver.Range(pkg.version.major.toString())
  const mostMajor = versions.filter(v => semver.satisfies(v[0], majorRange)).slice(-1)[0]

  if (semver.neq(mostMajor[0], pkg.version)) return
  // ^^ if we’re not the most major we definitely aren’t the newest

  await makeSymlink(`v${pkg.version.major}`)

  if (semver.eq(pkg.version, newest[0])) {
    await makeSymlink('v*')
  }

  async function makeSymlink(symname: string) {
    const to = shelf.join(symname)
    console.verbose({ "symlinking:": to })
    await shelf.symlink({ from: (await installation).path, to, force: true })
  }
}
