import { Package, Installation } from "types"
import { useCellar } from "hooks"
import Path from "path"
import SemVer, * as semver from "semver"

export default async function link(pkg: Package | Installation) {
  let installation: Installation
  if ("version" in pkg) {
    installation = await useCellar().resolve(pkg)
  } else {
    installation = pkg
    pkg = installation.pkg
  }
  const versions = (await useCellar()
    .ls(installation.pkg.project))
    .map(({pkg: {version}, path}) => [version, path] as [SemVer, Path])
    .sort(([a],[b]) => semver.compare(a,b))

  const shelf = installation.path.parent()
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
