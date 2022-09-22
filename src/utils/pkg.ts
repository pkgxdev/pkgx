import { Package, PackageRequirement } from "types"
import SemVer, * as semver from "semver"

export function parse(input: string): PackageRequirement | Package {
  const match = input.match(/^(.*?)([\^=~<>@].+)?$/)
  if (!match) throw new Error(`invalid pkgspec: ${input}`)
  if (!match[2]) match[2] = "*"

  const project = match[1]

  if (match[2].startsWith("@") || match[2].startsWith("=")) {
    return {
      project,
      version: new SemVer(match[2].slice(1))
    }
  } else {
    const constraint = new semver.Range(match[2])
    const version = constraint.single()

    if (version) {
      return { project, version }
    } else {
      return { project, constraint }
    }
  }
}

export function compare(a: Package, b: Package): number {
  return a.project === b.project
    ? a.version.compare(b.version)
    : a.project.localeCompare(b.project)
}

export function str(pkg: Package | PackageRequirement): string {
  if ("constraint" in pkg) {
    if (pkg.constraint.set === "*") {
      return pkg.project
    } else {
      return `${pkg.project}${pkg.constraint.toString()}`
    }
  } else {
    return `${pkg.project}@${pkg.version.toString()}`
  }
}
