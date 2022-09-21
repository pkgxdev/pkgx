import { Package, PackageRequirement, Installation } from "types"
import { compare_pkg, pkg_str } from "utils"
import { usePrefix } from "hooks"
import Path from "path"
import SemVer, * as semver from "semver"

export default function useCellar() {
  return {
    isInstalled,
    ls,
    keg,
    resolve,
    shelf,
  }
}

/// returns the `Installation` if the pkg is installed
async function isInstalled(pkg: Package | PackageRequirement) {
  const resolution = await resolve(pkg).swallow(/^not-found:/)
  if (resolution && !await vacant(resolution.path)) {
    return resolution
  }
}

/// returns all installed versions of a project
async function ls(project: string) {
  const prefix = usePrefix()

  if (!prefix.join(project).isDirectory()) return []

  const rv: Installation[] = []
  for await (const [path, entry] of prefix.join(project).ls()) {
    try {
      if (!entry.isDirectory) continue
      const version = new SemVer(entry.name)
      if (await vacant(path)) continue
      rv.push({path, pkg: {project, version}})
    } catch {
      //TODO only semver errors
    }
  }
  return rv.sort((a, b) => compare_pkg(a.pkg, b.pkg))
}

/// if package is installed, returns its installation
async function resolve(pkg: Package | PackageRequirement | Path) {
  const installation = await (async () => {
    const prefix = usePrefix()
    if (pkg instanceof Path) {
      const path = pkg
      const version = new SemVer(path.basename())
      const project = path.parent().relative({ to: prefix })
      return {
        path, pkg: { project, version }
      }
    } else if ("version" in pkg) {
      const path = prefix.join(pkg.project).join(`v${pkg.version}`)
      return { path, pkg }
    } else {
      const installations = await ls(pkg.project)
      const versions = installations.map(({ pkg: {version}}) => version)
      const version = semver.maxSatisfying(versions, pkg.constraint)
      console.debug({ installations, versions, version })
      if (version) {
        const path = installations.find(({pkg: {version: v}}) => semver.eq(v, version))!.path
        return { path, pkg: { project: pkg.project, version } }
      }
    }
    throw new Error(`not-found:${pkg_str(pkg)}`)
  })()
  if (await vacant(installation.path)) {
    throw new Error(`not-found:${pkg_str(installation.pkg)}`)
  }
  return installation
}

/// eg. ~/.tea/deno.land
const shelf = (project: string) => usePrefix().join(project)

/// returns the installation directory
const keg = (pkg: Package) => shelf(pkg.project).join(`v${pkg.version}`)

/// if we ignore transient files, is there a package here?
async function vacant(path: Path): Promise<boolean> {
  if (!path.isDirectory()) {
    return true
  } else for await (const _ of path.ls()) {
    return false
  }
  return true
}
