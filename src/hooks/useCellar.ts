import { Path, Package, PackageRequirement, SemVer, semver, Installation } from "types"
import { packageSort } from "utils"

//TODO useCellar should take a project name and then all functions operate on that

interface Return {
  /// returns the installation directory, creating it if necessary
  mkpath(pkg: Package): Path
  /// if package is installed, returns its installation
  resolve(pkg: Package | PackageRequirement): Promise<Installation>
  /// returns all installed versions of a project
  ls(project: string): Promise<Installation[]>
  /// typically: /opt
  prefix: Path

  /// eg. /opt/deno.land
  shelf(project: string): Path

  isInstalled(pkg: Package | PackageRequirement): Promise<Installation | undefined>
}

export default function useCellar(): Return {
  const prefix = Path.root.join("opt")

  const ls = async (project: string) => {
    if (prefix.join(project).isDirectory() == false) return []

    const rv: Installation[] = []
    for await (const [path, entry] of prefix.join(project).ls()) {
      try {
        if (!entry.isDirectory) continue
        if (await looksEmpty(path)) continue
        const version = new SemVer(entry.name)
        rv.push({path, pkg: {project, version}})
      } catch (err) {
        //TODO only semver errors
      }
    }
    return rv.sort((a, b) => packageSort(a.pkg, b.pkg))
  }

  const resolve = async (pkg: Package | PackageRequirement) => {
    if ("version" in pkg) {
      const path = prefix.join(pkg.project).join(`v${pkg.version}`)
      if (path.isDirectory() && !path.join(".building").exists()) {
        return { path, pkg }
      }
    } else {
      const installations = await ls(pkg.project)
      const versions = installations.map(({ pkg: {version}}) => version)
      const version = semver.maxSatisfying(versions, pkg.constraint)
      if (version) {
        const path = installations.find(({pkg: {version: v}}) => semver.eq(v, version))!.path
        return { path, pkg: { project: pkg.project, version } }
      }
    }
    throw new Error(`not-found:${str(pkg)}`)
  }

  const shelf = (project: string) => {
    return prefix.join(project)
  }

  const mkpath = (pkg: Package) => prefix.join(pkg.project, `v${pkg.version}`).mkpath()

  const isInstalled = async (pkg: Package | PackageRequirement) => {
    const resolution = await resolve(pkg).swallow(/^not-found:/)
    if (resolution && await looksEmpty(resolution.path)) { return undefined }
    return resolution
  }

  return { resolve, ls, mkpath, prefix, shelf, isInstalled }
}


async function looksEmpty(path: Path): Promise<boolean> {
  for await (const [_,{name}] of path.ls()) {
    switch (name) {
      case "src":
      case "build.sh":
      case "files.txt":
        continue
      default:
        return false
    }
  }
  return true
}

function str(pkg: Package | PackageRequirement): string {
  if ("constraint" in pkg) {
    return `${pkg.project}@${pkg.constraint}`
  } else {
    return `${pkg.project}@${pkg.version}`
  }
}